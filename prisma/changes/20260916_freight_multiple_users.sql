BEGIN;
ALTER TABLE "freight_access" ADD COLUMN "responsible_ids" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "freight_access" DROP COLUMN IF EXISTS "responsible_id";
COMMIT;
