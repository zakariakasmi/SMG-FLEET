-- =====================================================
-- Tachograph demands — three-step status workflow
-- =====================================================
-- A demand now moves through:
--   open   -> En cours   (the site asked for a repair / an inspection)
--   done   -> Terminé    (the requester says the work is done)
--   closed -> Traité     (the fleet manager has processed the demand)
--
-- Rows already marked `done` were handled end-to-end under the old two-step
-- workflow (they were the manager's "traitée"), so they become `closed`.
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =====================================================

BEGIN;

ALTER TABLE tacho_demands DROP CONSTRAINT IF EXISTS tacho_demands_status_check;

UPDATE tacho_demands SET status = 'closed' WHERE status = 'done';

ALTER TABLE tacho_demands ALTER COLUMN status SET DEFAULT 'open';

ALTER TABLE tacho_demands
  ADD CONSTRAINT tacho_demands_status_check
  CHECK (status IN ('open', 'done', 'closed'));

COMMIT;
