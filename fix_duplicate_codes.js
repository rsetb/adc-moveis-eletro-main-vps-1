
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function formatCustomerCode(value) {
    return String(value).padStart(5, '0');
}

async function fixDuplicates() {
    console.log('Starting duplicate fix process...');

    // 1. Fetch all customers
    const { data: customers, error } = await supabase
        .from('customers')
        .select('id, name, code')
        .order('code', { ascending: true }); // Order by code to easily find max

    if (error) {
        console.error('Error fetching customers:', error);
        return;
    }

    if (!customers || customers.length === 0) {
        console.log('No customers found.');
        return;
    }

    // 2. Find max code to initialize counter correctly later
    let maxCode = 0;
    customers.forEach(c => {
        const num = parseInt(c.code, 10);
        if (!isNaN(num) && num > maxCode) {
            maxCode = num;
        }
    });
    console.log(`Current highest code found: ${maxCode}`);

    // 3. Identify duplicates
    const codeMap = new Map();
    const customersToUpdate = [];
    let nextAvailableCode = maxCode + 1;

    // First pass: populate map
    for (const customer of customers) {
        if (!customer.code) {
            // Treat missing code as a duplicate to be assigned
            customer.code = "MISSING";
        }

        if (customer.code === "MISSING" || codeMap.has(customer.code)) {
            // This is a duplicate or missing! Assign new code.
            const newCode = formatCustomerCode(nextAvailableCode);
            nextAvailableCode++;

            customersToUpdate.push({
                ...customer,
                newCode: newCode
            });
            console.log(`Will update ${customer.name} (Old: ${customer.code}) -> New: ${newCode}`);
        } else {
            codeMap.set(customer.code, customer);
        }
    }

    // 4. Update customers with new codes
    if (customersToUpdate.length === 0) {
        console.log('No duplicate codes found to fix.');
    } else {
        console.log(`Fixing ${customersToUpdate.length} customers...`);
        for (const customer of customersToUpdate) {
            const { error: updateError } = await supabase
                .from('customers')
                .update({ code: customer.newCode })
                .eq('id', customer.id);

            if (updateError) {
                console.error(`Failed to update customer ${customer.id}:`, updateError);
            } else {
                console.log(`Updated ${customer.name} to code ${customer.newCode}`);
            }
        }
    }

    // 5. Update the global config counter to the new max
    // Use nextAvailableCode - 1 because nextAvailableCode is the NEXT one, so the last used is -1.
    // However, if we didn't update anything, nextAvailableCode is maxCode + 1.
    const finalLastNumber = nextAvailableCode - 1;
    console.log(`Setting global customerCodeCounter to: ${finalLastNumber}`);

    const { error: configError } = await supabase
        .from('config')
        .upsert({
            key: 'customerCodeCounter',
            value: { lastNumber: finalLastNumber }
        });

    if (configError) {
        console.error('Error updating config table:', configError);
        // If config table doesn't exist, we might need to create it or different strategy, 
        // but verify_file showed it checks 'config' table so it should exist.
    } else {
        console.log('Global counter updated successfully.');
    }
}

fixDuplicates();
