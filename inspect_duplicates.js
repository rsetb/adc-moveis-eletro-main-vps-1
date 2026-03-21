require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase (mesmas credenciais do projeto)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCustomers() {
    console.log('Buscando clientes com código "02404"...');

    const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('code', '02404');

    if (error) {
        console.error('Erro ao buscar clientes:', error);
        return;
    }

    if (customers.length === 0) {
        console.log('Nenhum cliente encontrado com esse código exato.');
        return;
    }

    console.log(`Encontrados ${customers.length} clientes com código "02404":`);
    customers.forEach(c => {
        console.log(`ID: ${c.id}`);
        console.log(`Nome: ${c.name}`);
        console.log(`Code: '${c.code}'`);
        console.log(`Created At: ${c.created_at}`);
        console.log('---');
    });
}

inspectCustomers();
