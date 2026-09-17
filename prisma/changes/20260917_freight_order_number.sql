-- Campo opcional; preserva os fretes já cadastrados.
ALTER TABLE "freight_payments"
  ADD COLUMN IF NOT EXISTS "order_number" TEXT;
