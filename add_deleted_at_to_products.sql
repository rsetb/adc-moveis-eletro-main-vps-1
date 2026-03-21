-- Script para adicionar a coluna 'deleted_at' na tabela 'products'
-- Isso permite a funcionalidade de "Lixeira" (Soft Delete)

ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at text; -- Usando text para simplificar com ISO String, pode ser timestampz também

COMMENT ON COLUMN products.deleted_at IS 'Data de exclusão do produto (Soft Delete). Se nulo, o produto está ativo.';
