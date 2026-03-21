-- Execute estas linhas no Editor SQL do Supabase para suportar a classificação de clientes

ALTER TABLE customers ADD COLUMN IF NOT EXISTS "rating" numeric;

-- Opcional: Definir média padrão como null ou 0 se preferir
-- ALTER TABLE customers ALTER COLUMN "rating" SET DEFAULT null;
