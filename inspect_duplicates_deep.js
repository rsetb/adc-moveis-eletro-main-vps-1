
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

async function inspectDeep() {
    console.log('Fetching ALL customers for deep inspection...');

    // Fetch all customers - handling pagination if > 1000 just in case, though usually 1000 limit default
    // We'll increment range
    let allCustomers = [];
    let from = 0;
    let step = 1000;
    let keepFetching = true;

    while (keepFetching) {
        const { data, error } = await supabase
            .from('customers')
            .select('id, name, code')
            .range(from, from + step - 1);

        if (error) {
            console.error('Error fetching:', error);
            break;
        }

        if (data.length === 0) {
            keepFetching = false;
        } else {
            allCustomers = [...allCustomers, ...data];
            from += step;
            if (data.length < step) keepFetching = false;
        }
    }

    console.log(`Total customers scanned: ${allCustomers.length}`);

    const codeMap = new Map();
    const duplicates = [];
    const missingCode = [];

    allCustomers.forEach(c => {
        let cleanCode = c.code;

        if (cleanCode === null || cleanCode === undefined || cleanCode === '') {
            missingCode.push(c);
            return;
        }

        // Normalize: trim whitespace
        cleanCode = String(cleanCode).trim();

        if (codeMap.has(cleanCode)) {
            // Found a duplicate
            const original = codeMap.get(cleanCode);
            // Check if we already added this group to duplicates
            const existingGroup = duplicates.find(d => d.code === cleanCode);

            if (existingGroup) {
                existingGroup.ids.push({ id: c.id, name: c.name });
            } else {
                duplicates.push({
                    code: cleanCode,
                    ids: [
                        { id: original.id, name: original.name },
                        { id: c.id, name: c.name }
                    ]
                });
            }
        } else {
            codeMap.set(cleanCode, c);
        }
    });

    if (missingCode.length > 0) {
        console.log(`\n⚠️ Found ${missingCode.length} customers with MISSING codes!`);
        missingCode.forEach(c => console.log(`  - ${c.name} (ID: ${c.id})`));
    }

    if (duplicates.length > 0) {
        console.log(`\n❌ Found ${duplicates.length} duplicate code groups:`);
        duplicates.forEach(d => {
            console.log(`\nCode: "${d.code}"`);
            d.ids.forEach(c => console.log(`  - ${c.name} (${c.id})`));
        });
    } else {
        console.log('\n✅ No duplicates found (Deep Check Passed).');
    }
}

inspectDeep();
