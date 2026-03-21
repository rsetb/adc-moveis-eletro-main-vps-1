
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
    console.log('--- INICIANDO VERIFICAÇÃO SEQUENCIAL (1, 2, 3) ---');

    // 1. Verificar Configurações da Loja
    console.log('\n[1] Testando Configurações (storeSettings)...');
    const { data: settings, error: sError } = await supabase
        .from('config')
        .select('*')
        .eq('key', 'storeSettings')
        .maybeSingle();

    if (sError) console.error('Erro no Passo 1:', sError);
    else if (settings) console.log('✅ Passo 1 (Config) OK: ' + settings.value.storeName);
    else console.log('❌ Passo 1 (Config): Não encontrado.');

    // 2. Verificar Permissões de Papéis
    console.log('\n[2] Testando Permissões (rolePermissions)...');
    const { data: perms, error: pError } = await supabase
        .from('config')
        .select('*')
        .eq('key', 'rolePermissions')
        .maybeSingle();

    if (pError) console.error('Erro no Passo 2:', pError);
    else if (perms) console.log('✅ Passo 2 (Permissões) OK: Papéis encontrados: ' + Object.keys(perms.value).join(', '));
    else console.log('❌ Passo 2 (Permissões): Não encontrado.');

    // 3. Verificar Contador de Código de Cliente
    console.log('\n[3] Testando Contador de Cliente (customerCodeCounter)...');
    const { data: counter, error: cError } = await supabase
        .from('config')
        .select('*')
        .eq('key', 'customerCodeCounter')
        .maybeSingle();

    if (cError) console.error('Erro no Passo 3:', cError);
    else if (counter) console.log('✅ Passo 3 (Contador) OK: Último número: ' + counter.value.lastNumber);
    else console.log('❌ Passo 3 (Contador): Não encontrado.');

    console.log('\n--- VERIFICAÇÃO CONCLUÍDA ---');
}

runTests();
