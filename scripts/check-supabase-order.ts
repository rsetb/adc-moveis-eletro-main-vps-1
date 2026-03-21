
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Fetching one order from Supabase...');
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching order:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No orders found.');
        return;
    }

    const order = data[0];
    console.log('--- Order Fields ---');
    console.log('ID:', order.id);
    console.log('Status:', order.status);
    console.log('Down Payment (root):', order.down_payment);
    console.log('Discount (root):', order.discount);

    console.log('\n--- Installment Details (JSON) ---');
    console.log(JSON.stringify(order.installment_details, null, 2));

    console.log('\n--- items (JSON) ---');
    console.log(JSON.stringify(order.items, null, 2));

    console.log('\n--- Customer (JSON) ---');
    console.log(JSON.stringify(order.customer, null, 2));
}

main();
