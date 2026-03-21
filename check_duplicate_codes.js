
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

async function checkDuplicates() {
    console.log('Fetching customers...');

    // Fetch all customers, specifically getting code, id, and name
    const { data: customers, error } = await supabase
        .from('customers')
        .select('id, name, code');

    if (error) {
        console.error('Error fetching customers:', error);
        return;
    }

    if (!customers || customers.length === 0) {
        console.log('No customers found.');
        return;
    }

    console.log(`Found ${customers.length} customers. Checking for duplicates...`);

    const codeMap = new Map();
    const duplicates = [];

    customers.forEach(customer => {
        const code = customer.code;
        if (code) { // Only check if code exists
            if (codeMap.has(code)) {
                // Determine if this exact group is already in duplicates list
                const existingGroup = duplicates.find(d => d.code === code);
                if (existingGroup) {
                    existingGroup.customers.push({ id: customer.id, name: customer.name });
                } else {
                    // Start a new duplicate group with the original one found and this new one
                    const original = codeMap.get(code);
                    duplicates.push({
                        code: code,
                        customers: [
                            { id: original.id, name: original.name },
                            { id: customer.id, name: customer.name }
                        ]
                    });
                }
            } else {
                codeMap.set(code, customer);
            }
        }
    });

    if (duplicates.length === 0) {
        console.log('No duplicate codes found.');
    } else {
        console.log('Found duplicate codes:');
        duplicates.forEach(dup => {
            console.log(`\nCode: ${dup.code}`);
            dup.customers.forEach(c => console.log(`  - Name: ${c.name}, ID: ${c.id}`));
        });
    }
}

checkDuplicates();
