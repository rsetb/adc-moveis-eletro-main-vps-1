-- Execute estas linhas no Editor SQL do Supabase para suportar o bloqueio de clientes

ALTER TABLE customers ADD COLUMN IF NOT EXISTS "blocked" boolean DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "blockedReason" text;

-- Comentário: As aspas em "blockedReason" são importantes se o banco diferencia maiúsculas/minúsculas, 
-- já que o código TypeScript envia 'blockedReason'.
