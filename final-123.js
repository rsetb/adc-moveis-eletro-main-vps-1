
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
    console.log('--- EXECUÇÃO FINAL: PASSOS 1, 2 e 3 ---');

    // 1. Configurações
    const { data: s } = await supabase.from('config').select('*').eq('key', 'storeSettings').maybeSingle();
    console.log('[1] Configurações: ' + (s ? '✅ OK (' + s.value.storeName + ')' : '❌ ERRO'));

    // 2. Permissões
    const { data: p } = await supabase.from('config').select('*').eq('key', 'rolePermissions').maybeSingle();
    console.log('[2] Permissões: ' + (p ? '✅ OK (' + Object.keys(p.value).length + ' papéis)' : '❌ ERRO'));

    // 3. Contador
    const { data: c } = await supabase.from('config').select('*').eq('key', 'customerCodeCounter').maybeSingle();
    console.log('[3] Contador: ' + (c ? '✅ OK (Último: ' + c.value.lastNumber + ')' : '❌ ERRO'));

    console.log('--- FIM DO TESTE ---');
}
runTests();
