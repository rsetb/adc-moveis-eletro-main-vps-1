ALTER TABLE "freight_payments" ADD COLUMN IF NOT EXISTS "received_cents" INTEGER;
ALTER TABLE "freight_payments" ADD COLUMN IF NOT EXISTS "payment_method" TEXT;
