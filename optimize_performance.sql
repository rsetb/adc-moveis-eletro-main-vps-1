-- Add indexes to frequently filtering/order columns to improve performance

-- Customers table
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON customers(cpf);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- Orders table
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_cpf ON orders((customer->>'cpf'));
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders("sellerId");

-- Products table
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_hidden ON products(is_hidden);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

-- Commission Payments
CREATE INDEX IF NOT EXISTS idx_commission_payments_seller_id ON commission_payments("sellerId");
CREATE INDEX IF NOT EXISTS idx_commission_payments_date ON commission_payments("paymentDate" DESC);

-- Analyze tables to update statistics
ANALYZE customers;
ANALYZE orders;
ANALYZE products;
ANALYZE commission_payments;
