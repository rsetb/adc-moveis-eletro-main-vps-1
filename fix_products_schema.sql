-- Script para atualizar a tabela 'products' com as colunas necessárias
-- Copie e cole este código no Editor SQL do Supabase e clique em RUN.

-- Adicionar colunas se não existirem
ALTER TABLE products ADD COLUMN IF NOT EXISTS long_description text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock numeric DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit text DEFAULT 'UN';
ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS on_sale boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS promotion_end_date text; -- Pode ser timestamp, mas text é mais flexível para o frontend atual
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls text[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_installments numeric DEFAULT 12;
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_condition text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_type text DEFAULT 'percentage'; -- 'percentage' ou 'fixed'
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_value numeric DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS data_ai_hint text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by_name text;

-- Garantir que a coluna id seja texto (se não for uuid)
-- ALTER TABLE products ALTER COLUMN id TYPE text; 

-- Atualizar comentários (opcional)
COMMENT ON COLUMN products.min_stock IS 'Estoque mínimo para alerta';
COMMENT ON COLUMN products.commission_value IS 'Valor da comissão ou porcentagem';
