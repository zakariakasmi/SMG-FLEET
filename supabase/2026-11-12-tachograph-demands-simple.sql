-- =====================================================
-- Tachograph demands — simplified request form
-- =====================================================
-- The demand is the site's request to the fleet manager ("this vehicle needs
-- a repair / a periodic inspection"). It is not a purchasing document: the
-- supplier, the delivery note (BL) and the purchase order (BC) are handled
-- later, in the operations book.
--
-- What changes:
--   * statuses: open / done (the old bl_received / approved / cancelled go away)
--   * no supplier, no "needed by" date, no BL/BC columns
--   * a line is a vehicle + a kind: 'reparation' | 'visite_periodique'
--     (the demand no longer picks a precise operation type — that is chosen
--      when the real operation is logged)
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Statuses: open -> done
-- =====================================================
ALTER TABLE tacho_demands DROP CONSTRAINT IF EXISTS tacho_demands_status_check;

-- Fold the old statuses before re-adding the constraint. A demand that had a
-- BL or a BC was already handled, so it becomes done.
UPDATE tacho_demands SET status = 'done' WHERE status IN ('bl_received', 'approved');
UPDATE tacho_demands SET status = 'open' WHERE status = 'cancelled';

ALTER TABLE tacho_demands ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE tacho_demands
  ADD CONSTRAINT tacho_demands_status_check CHECK (status IN ('open', 'done'));

-- =====================================================
-- 2. Fields the requester never fills
-- =====================================================
ALTER TABLE tacho_demands
  DROP COLUMN IF EXISTS supplier_id,
  DROP COLUMN IF EXISTS needed_by,
  DROP COLUMN IF EXISTS bl_number,
  DROP COLUMN IF EXISTS bl_received_on,
  DROP COLUMN IF EXISTS bc_number,
  DROP COLUMN IF EXISTS bc_issued_on;

-- =====================================================
-- 3. Lines: vehicle + kind
-- =====================================================
ALTER TABLE tacho_demand_items
  ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'reparation';

ALTER TABLE tacho_demand_items DROP CONSTRAINT IF EXISTS tacho_demand_items_kind_check;
ALTER TABLE tacho_demand_items
  ADD CONSTRAINT tacho_demand_items_kind_check
  CHECK (kind IN ('reparation', 'visite_periodique'));

-- The precise operation type is picked when the operation is logged.
ALTER TABLE tacho_demand_items ALTER COLUMN operation_type_id DROP NOT NULL;

-- One line = one vehicle and one kind; the quantity was never used.
ALTER TABLE tacho_demand_items DROP COLUMN IF EXISTS quantity;

COMMIT;
