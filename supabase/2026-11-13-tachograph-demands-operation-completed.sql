-- =====================================================
-- Tachograph demands — an operation completes the demand
-- =====================================================
-- Logging the operation that fulfils a demand is the end of the demand: as soon
-- as a demand carries its operation it is "Terminé" (closed). There is no
-- manual step left on the demand side.
--
-- "Traité" (done) remains the manual intermediate step for a demand that is
-- handled before its operation is logged; it can still be finalised by hand.
--
-- This backfills the rows that already have an operation and enforces the rule
-- on every insert/update, so the stored status can never drift from reality
-- again (older rows, a link written outside the app, a failed client call).
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =====================================================

BEGIN;

-- 1. Rows already fulfilled by an operation but not shown as completed.
UPDATE tacho_demands
   SET status = 'closed',
       updated_at = NOW()
 WHERE operation_id IS NOT NULL
   AND status <> 'closed';

-- 2. Keep it true from now on. A demand that has an operation is completed;
--    the trigger only moves rows forward, it never reopens anything.
CREATE OR REPLACE FUNCTION tacho_demands_complete_with_operation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.operation_id IS NOT NULL AND NEW.status <> 'closed' THEN
    NEW.status := 'closed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tacho_demands_operation_status ON tacho_demands;

CREATE TRIGGER tacho_demands_operation_status
  BEFORE INSERT OR UPDATE ON tacho_demands
  FOR EACH ROW
  EXECUTE FUNCTION tacho_demands_complete_with_operation();

COMMIT;
