
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

async function fixDuplicatesCorrectly() {
    console.log('Starting TRUE duplicate fix process...');

    // 1. Fetch ALL customers via pagination
    let allCustomers = [];
    let from = 0;
    let step = 1000;
    let keepFetching = true;

    while (keepFetching) {
        process.stdout.write(`Fetching customers ${from} to ${from + step}... \r`);
        const { data, error } = await supabase
            .from('customers')
            .select('id, name, code')
            .range(from, from + step - 1);

        if (error) {
            console.error('\nError fetching customers:', error);
            return;
        }

        if (data.length === 0) {
            keepFetching = false;
        } else {
            allCustomers = [...allCustomers, ...data];
            from += step;
            if (data.length < step) keepFetching = false;
        }
    }
    console.log(`\nTotal customers scanned: ${allCustomers.length}`);

    // 2. Find TRUE max code
    let maxCode = 0;
    allCustomers.forEach(c => {
        const num = parseInt(c.code, 10);
        if (!isNaN(num) && num > maxCode) {
            maxCode = num;
        }
    });
    console.log(`True highest code found in DB: ${maxCode}`);

    // 3. Identify duplicates
    const codeMap = new Map();
    const customersToUpdate = [];
    let nextAvailableCode = maxCode + 1;

    for (const customer of allCustomers) {
        let cleanCode = customer.code ? String(customer.code).trim() : "MISSING";

        if (cleanCode === "MISSING" || codeMap.has(cleanCode)) {
            // Found duplicate
            const newCode = formatCustomerCode(nextAvailableCode);
            nextAvailableCode++;

            customersToUpdate.push({
                ...customer,
                oldCode: cleanCode,
                newCode: newCode
            });
            console.log(`Duplicate/Missing Found: ${customer.name} (Code: ${cleanCode}) -> Will set to: ${newCode}`);
        } else {
            codeMap.set(cleanCode, customer);
        }
    }

    // 4. Execute updates
    if (customersToUpdate.length === 0) {
        console.log('No duplicate codes found.');
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
                console.log(`Updated ${customer.name} from ${customer.oldCode} to ${customer.newCode}`);
            }
        }
    }

    // 5. Update global counter
    const finalLastNumber = nextAvailableCode - 1;
    console.log(`Updating global customerCodeCounter to: ${finalLastNumber}`);

    const { error: configError } = await supabase
        .from('config')
        .upsert({
            key: 'customerCodeCounter',
            value: { lastNumber: finalLastNumber }
        });

    if (configError) {
        console.error('Error updating config table:', configError);
    } else {
        console.log('Global counter updated successfully.');
    }
}

fixDuplicatesCorrectly();
