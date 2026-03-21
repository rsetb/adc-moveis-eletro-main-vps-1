
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

async function testSettings() {
    console.log('Testing Supabase settings fetch...');
    try {
        const { data, error } = await supabase.from('config').select('*').eq('key', 'rolePermissions').maybeSingle();
        if (error) {
            console.error('Supabase Error (config):', error);
        } else if (data) {
            console.log('Role Permissions found:', JSON.stringify(data.value, null, 2));
        } else {
            console.log('Role Permissions NOT found in config table');
        }
    } catch (err) {
        console.error('Crashed:', err);
    }
}

testSettings();
