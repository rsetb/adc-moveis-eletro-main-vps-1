-- Alteração aditiva: não modifica tabelas nem registros existentes.
BEGIN;

CREATE TABLE "freight_access" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "owner_id" TEXT NOT NULL,
  "responsible_id" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "freight_payments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "delivery_date" DATE NOT NULL,
  "customer_name" TEXT NOT NULL,
  "neighborhood" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL CHECK ("amount_cents" > 0),
  "notes" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_by_name" TEXT NOT NULL,
  "paid_at" TIMESTAMP(3),
  "paid_by_id" TEXT,
  "paid_by_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "freight_payments_delivery_date_idx" ON "freight_payments"("delivery_date");
CREATE INDEX "freight_payments_paid_at_idx" ON "freight_payments"("paid_at");

CREATE TABLE "freight_payment_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "freight_id" TEXT NOT NULL REFERENCES "freight_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actor_id" TEXT NOT NULL,
  "actor_name" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "freight_payment_events_freight_id_created_at_idx" ON "freight_payment_events"("freight_id", "created_at");

COMMIT;
