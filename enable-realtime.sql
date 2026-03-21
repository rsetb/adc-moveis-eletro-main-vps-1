-- Script para Habilitar Supabase Realtime em TODAS as Tabelas
-- Execute este script no SQL Editor do Supabase

-- 1. Habilitar Realtime para a publicação padrão (supabase_realtime)
-- Isso permite que todas as tabelas sejam monitoradas em tempo real

-- Adicionar tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers_trash;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_audits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.avarias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.config;

-- Verificar se as tabelas foram adicionadas
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Resultado esperado: você deve ver todas as 14 tabelas listadas acima
