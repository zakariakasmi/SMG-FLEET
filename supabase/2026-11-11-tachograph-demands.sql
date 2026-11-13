-- =====================================================
-- Tachograph module — demand forms (bons de demande)
-- =====================================================
-- SUPERSEDED by 2026-11-12-tachograph-demands-simple.sql: the demand is now a
-- plain request (vehicle + repair / periodic inspection) with no supplier and
-- no BL/BC tracking. Keep this file for history; a fresh database still applies
-- both, in order.
--
-- The paper trail before an intervention happens:
--
--   demande  →  the fleet manager asks a garage/worksite for a repair or a
--               periodic (paper) revision. Sent as a PDF, referenced DEM-YYYY-NNNN.
--   BL       →  the supplier delivers and the delivery note comes back; it is
--               checked against the demand.
--   BC       →  once the BL matches, the purchase order is issued and the
--               supplier gets the go-ahead.
--   operation→  the intervention is logged in tacho_operations and linked back
--               to its demand (`tacho_operations.demand_id`).
--
-- Statuses: open → bl_received → approved, plus cancelled.
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Reference sequence (DEM-2026-0001)
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS tacho_demands_ref_seq;

-- =====================================================
-- 2. Demands
-- =====================================================
CREATE TABLE IF NOT EXISTS tacho_demands (
  id SERIAL PRIMARY KEY,
  -- Filled by the trigger below when the client does not send one.
  reference VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'bl_received', 'approved', 'cancelled')),
  requested_on DATE NOT NULL DEFAULT CURRENT_DATE,
  -- When the worksite needs the vehicle back / the intervention done.
  needed_by DATE,
  -- Chosen when the demand is sent; the BC confirms it later.
  supplier_id INTEGER REFERENCES tacho_suppliers(id) ON DELETE SET NULL,
  chantier TEXT,
  requested_by VARCHAR(150),
  notes TEXT,
  -- Delivery note (BL) received from the supplier.
  bl_number VARCHAR(100),
  bl_received_on DATE,
  -- Purchase order (BC) issued after the BL was checked.
  bc_number VARCHAR(100),
  bc_issued_on DATE,
  -- The operation logged from this demand, once the intervention is done.
  operation_id INTEGER REFERENCES tacho_operations(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tacho_demands_status ON tacho_demands(status);
CREATE INDEX IF NOT EXISTS idx_tacho_demands_requested ON tacho_demands(requested_on DESC);
CREATE INDEX IF NOT EXISTS idx_tacho_demands_supplier ON tacho_demands(supplier_id);
CREATE INDEX IF NOT EXISTS idx_tacho_demands_operation ON tacho_demands(operation_id);

-- =====================================================
-- 3. Demand lines (one article per vehicle, like an operation)
-- =====================================================
CREATE TABLE IF NOT EXISTS tacho_demand_items (
  id SERIAL PRIMARY KEY,
  demand_id INTEGER NOT NULL REFERENCES tacho_demands(id) ON DELETE CASCADE,
  operation_type_id INTEGER NOT NULL REFERENCES tacho_operation_types(id) ON DELETE RESTRICT,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tacho_demand_items_demand ON tacho_demand_items(demand_id);
CREATE INDEX IF NOT EXISTS idx_tacho_demand_items_type ON tacho_demand_items(operation_type_id);
CREATE INDEX IF NOT EXISTS idx_tacho_demand_items_vehicle ON tacho_demand_items(vehicle_id);

-- =====================================================
-- 4. Human-readable reference
-- =====================================================
CREATE OR REPLACE FUNCTION tacho_demand_set_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference IS NULL OR btrim(NEW.reference) = '' THEN
    NEW.reference := 'DEM-'
      || to_char(COALESCE(NEW.requested_on, CURRENT_DATE), 'YYYY')
      || '-' || lpad(nextval('tacho_demands_ref_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tacho_demands_set_reference ON tacho_demands;
CREATE TRIGGER tacho_demands_set_reference
  BEFORE INSERT ON tacho_demands
  FOR EACH ROW EXECUTE FUNCTION tacho_demand_set_reference();

-- =====================================================
-- 5. Link an operation back to its demand
-- =====================================================
ALTER TABLE tacho_operations
  ADD COLUMN IF NOT EXISTS demand_id INTEGER REFERENCES tacho_demands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tacho_operations_demand ON tacho_operations(demand_id);

COMMENT ON COLUMN tacho_operations.demand_id IS 'Demand form this operation fulfils';

-- =====================================================
-- 6. RLS — same model as the rest of the module
--    read: any authenticated user
--    write: add/edit/deleteTachograph (admins bypass via user_has_permission)
-- =====================================================
ALTER TABLE tacho_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE tacho_demand_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tacho_demands_read ON tacho_demands;
DROP POLICY IF EXISTS tacho_demands_insert ON tacho_demands;
DROP POLICY IF EXISTS tacho_demands_update ON tacho_demands;
DROP POLICY IF EXISTS tacho_demands_delete ON tacho_demands;

CREATE POLICY tacho_demands_read ON tacho_demands
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tacho_demands_insert ON tacho_demands
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_has_permission('addTachograph')));
CREATE POLICY tacho_demands_update ON tacho_demands
  FOR UPDATE TO authenticated
  USING ((SELECT public.user_has_permission('editTachograph')))
  WITH CHECK ((SELECT public.user_has_permission('editTachograph')));
CREATE POLICY tacho_demands_delete ON tacho_demands
  FOR DELETE TO authenticated
  USING ((SELECT public.user_has_permission('deleteTachograph')));

DROP POLICY IF EXISTS tacho_demand_items_read ON tacho_demand_items;
DROP POLICY IF EXISTS tacho_demand_items_insert ON tacho_demand_items;
DROP POLICY IF EXISTS tacho_demand_items_update ON tacho_demand_items;
DROP POLICY IF EXISTS tacho_demand_items_delete ON tacho_demand_items;

CREATE POLICY tacho_demand_items_read ON tacho_demand_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tacho_demand_items_insert ON tacho_demand_items
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_has_permission('addTachograph')));
CREATE POLICY tacho_demand_items_update ON tacho_demand_items
  FOR UPDATE TO authenticated
  USING ((SELECT public.user_has_permission('editTachograph')))
  WITH CHECK ((SELECT public.user_has_permission('editTachograph')));
CREATE POLICY tacho_demand_items_delete ON tacho_demand_items
  FOR DELETE TO authenticated
  USING ((SELECT public.user_has_permission('deleteTachograph')));

-- =====================================================
-- 7. Data API grants (required for tables created after 2026-10-30)
-- =====================================================
GRANT SELECT ON public.tacho_demands, public.tacho_demand_items TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.tacho_demands,
  public.tacho_demand_items
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.tacho_demands,
  public.tacho_demand_items
TO service_role;

GRANT USAGE, SELECT ON SEQUENCE
  public.tacho_demands_id_seq,
  public.tacho_demand_items_id_seq,
  public.tacho_demands_ref_seq
TO authenticated, service_role;

COMMIT;
