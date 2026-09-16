-- Execute depois de 20260916_freight.sql, se a relação ainda não foi aplicada por db push.
-- A validação interrompe a alteração se já existir um titular sem usuário correspondente.
BEGIN;
ALTER TABLE "freight_access"
  ADD CONSTRAINT "freight_access_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
