/**
 * Script de Teste do Supabase Realtime
 * 
 * Como usar:
 * 1. Abra o console do navegador (F12)
 * 2. Cole este código e pressione Enter
 * 3. Veja os logs de conexão
 * 4. Em outra aba, crie um pedido
 * 5. Veja se aparece log aqui
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🚀 Iniciando teste de Supabase Realtime...');
console.log('📡 URL:', supabaseUrl);

// Teste de conexão
const testChannel = supabase
    .channel('realtime-test')
    .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
    }, (payload) => {
        console.log('✅ REALTIME FUNCIONANDO!', payload);
        console.log('📦 Tipo:', payload.eventType);
        console.log('📄 Dados:', payload.new);
    })
    .subscribe((status) => {
        console.log('📊 Status da conexão:', status);

        if (status === 'SUBSCRIBED') {
            console.log('✅ CONECTADO AO REALTIME!');
            console.log('👉 Agora crie um pedido em outra aba e veja aparecer aqui!');
        } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ ERRO NA CONEXÃO REALTIME');
            console.error('Verifique:');
            console.error('1. Realtime está habilitado no Supabase?');
            console.error('2. Políticas RLS estão configuradas?');
            console.error('3. Firewall bloqueando WebSocket?');
        } else if (status === 'TIMED_OUT') {
            console.error('⏱️ TIMEOUT - Conexão demorou muito');
            console.error('Verifique sua conexão de internet');
        }
    });

// Cleanup após 60 segundos
setTimeout(() => {
    console.log('⏹️ Encerrando teste...');
    supabase.removeChannel(testChannel);
}, 60000);

console.log('⏳ Aguardando conexão...');
