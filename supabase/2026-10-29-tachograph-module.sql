-- =====================================================
-- Tachograph module — suppliers, operation types, quotes, interventions
-- =====================================================
-- Brings the paper/periodic-revision workflow out of `charges` and into its own
-- model:
--
--   tacho_suppliers         garages / tachograph centres (external)
--   tacho_operation_types   réparation, révision périodique, révision papier, …
--   tacho_supplier_tariffs  one price per supplier × operation, date-ranged
--   tacho_operations        what was actually done on a fleet vehicle
--
-- `charges.chrono_tachygraphe` is untouched: it stays the annual cost line on a
-- vehicle. This module records the intervention and tracks the next revision.
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
--
-- Post-Oct-30 Supabase no longer grants Data API access to new tables, so the
-- GRANT block at the bottom is mandatory — without it PostgREST answers
-- "permission denied" even for admins.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Suppliers
-- =====================================================
CREATE TABLE IF NOT EXISTS tacho_suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  contact_name VARCHAR(150),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 2. Operation types (reference)
-- =====================================================
CREATE TABLE IF NOT EXISTS tacho_operation_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_fr VARCHAR(150) NOT NULL,
  name_en VARCHAR(150) NOT NULL,
  -- Drives the default "next revision due" date in the UI. NULL = no recurrence.
  default_interval_months INTEGER CHECK (default_interval_months IS NULL OR default_interval_months > 0),
  -- Periodic revisions produce the paper certificate / plaque.
  requires_certificate BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO tacho_operation_types (code, name_fr, name_en, default_interval_months, requires_certificate, sort_order) VALUES
  ('reparation',          'Réparation',          'Repair',             NULL, FALSE, 10),
  ('revision_periodique', 'Révision périodique', 'Periodic revision',    24, TRUE,  20),
  ('revision_papier',     'Révision papier',     'Paper revision',       24, TRUE,  30),
  ('etalonnage',          'Étalonnage',          'Calibration',          24, TRUE,  40),
  ('installation',        'Installation',        'Installation',       NULL, FALSE, 50)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 3. Supplier quotes (tarifs)
-- =====================================================
-- Date-ranged so an old intervention is always compared with the quote that was
-- valid on its date. A price change is a new row, never an overwrite.
CREATE TABLE IF NOT EXISTS tacho_supplier_tariffs (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES tacho_suppliers(id) ON DELETE CASCADE,
  operation_type_id INTEGER NOT NULL REFERENCES tacho_operation_types(id) ON DELETE CASCADE,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT tacho_supplier_tariffs_unique UNIQUE (supplier_id, operation_type_id, valid_from),
  CONSTRAINT tacho_supplier_tariffs_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_tacho_tariffs_supplier ON tacho_supplier_tariffs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_tacho_tariffs_type ON tacho_supplier_tariffs(operation_type_id);

-- =====================================================
-- 4. Operations (interventions)
-- =====================================================
-- `next_due_on` is stored on the operation (not derived at read time) so an
-- operator can override the interval, and so the due list is a simple indexed
-- range scan instead of a per-vehicle aggregate.
CREATE TABLE IF NOT EXISTS tacho_operations (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  supplier_id INTEGER NOT NULL REFERENCES tacho_suppliers(id) ON DELETE RESTRICT,
  operation_type_id INTEGER NOT NULL REFERENCES tacho_operation_types(id) ON DELETE RESTRICT,
  performed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  price_paid NUMERIC(12, 2) CHECK (price_paid IS NULL OR price_paid >= 0),
  certificate_no VARCHAR(100),
  certificate_expiry DATE,
  next_due_on DATE,
  reference VARCHAR(100),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tacho_operations_vehicle ON tacho_operations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tacho_operations_supplier ON tacho_operations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_tacho_operations_type ON tacho_operations(operation_type_id);
CREATE INDEX IF NOT EXISTS idx_tacho_operations_performed ON tacho_operations(performed_on DESC);
CREATE INDEX IF NOT EXISTS idx_tacho_operations_due ON tacho_operations(next_due_on);

-- =====================================================
-- 5. RLS — same model as the rest of the app
--    read: any authenticated user
--    write: add/edit/deleteTachograph (admins bypass via user_has_permission)
-- =====================================================
ALTER TABLE tacho_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tacho_operation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tacho_supplier_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tacho_operations ENABLE ROW LEVEL SECURITY;

-- ---------- tacho_suppliers ----------
DROP POLICY IF EXISTS tacho_suppliers_read ON tacho_suppliers;
DROP POLICY IF EXISTS tacho_suppliers_insert ON tacho_suppliers;
DROP POLICY IF EXISTS tacho_suppliers_update ON tacho_suppliers;
DROP POLICY IF EXISTS tacho_suppliers_delete ON tacho_suppliers;

CREATE POLICY tacho_suppliers_read ON tacho_suppliers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tacho_suppliers_insert ON tacho_suppliers
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_has_permission('addTachograph')));
CREATE POLICY tacho_suppliers_update ON tacho_suppliers
  FOR UPDATE TO authenticated
  USING ((SELECT public.user_has_permission('editTachograph')))
  WITH CHECK ((SELECT public.user_has_permission('editTachograph')));
CREATE POLICY tacho_suppliers_delete ON tacho_suppliers
  FOR DELETE TO authenticated
  USING ((SELECT public.user_has_permission('deleteTachograph')));

-- ---------- tacho_operation_types ----------
DROP POLICY IF EXISTS tacho_operation_types_read ON tacho_operation_types;
DROP POLICY IF EXISTS tacho_operation_types_insert ON tacho_operation_types;
DROP POLICY IF EXISTS tacho_operation_types_update ON tacho_operation_types;
DROP POLICY IF EXISTS tacho_operation_types_delete ON tacho_operation_types;

CREATE POLICY tacho_operation_types_read ON tacho_operation_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tacho_operation_types_insert ON tacho_operation_types
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_has_permission('addTachograph')));
CREATE POLICY tacho_operation_types_update ON tacho_operation_types
  FOR UPDATE TO authenticated
  USING ((SELECT public.user_has_permission('editTachograph')))
  WITH CHECK ((SELECT public.user_has_permission('editTachograph')));
CREATE POLICY tacho_operation_types_delete ON tacho_operation_types
  FOR DELETE TO authenticated
  USING ((SELECT public.user_has_permission('deleteTachograph')));

-- ---------- tacho_supplier_tariffs ----------
DROP POLICY IF EXISTS tacho_supplier_tariffs_read ON tacho_supplier_tariffs;
DROP POLICY IF EXISTS tacho_supplier_tariffs_insert ON tacho_supplier_tariffs;
DROP POLICY IF EXISTS tacho_supplier_tariffs_update ON tacho_supplier_tariffs;
DROP POLICY IF EXISTS tacho_supplier_tariffs_delete ON tacho_supplier_tariffs;

CREATE POLICY tacho_supplier_tariffs_read ON tacho_supplier_tariffs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tacho_supplier_tariffs_insert ON tacho_supplier_tariffs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_has_permission('addTachograph')));
CREATE POLICY tacho_supplier_tariffs_update ON tacho_supplier_tariffs
  FOR UPDATE TO authenticated
  USING ((SELECT public.user_has_permission('editTachograph')))
  WITH CHECK ((SELECT public.user_has_permission('editTachograph')));
CREATE POLICY tacho_supplier_tariffs_delete ON tacho_supplier_tariffs
  FOR DELETE TO authenticated
  USING ((SELECT public.user_has_permission('deleteTachograph')));

-- ---------- tacho_operations ----------
DROP POLICY IF EXISTS tacho_operations_read ON tacho_operations;
DROP POLICY IF EXISTS tacho_operations_insert ON tacho_operations;
DROP POLICY IF EXISTS tacho_operations_update ON tacho_operations;
DROP POLICY IF EXISTS tacho_operations_delete ON tacho_operations;

CREATE POLICY tacho_operations_read ON tacho_operations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tacho_operations_insert ON tacho_operations
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_has_permission('addTachograph')));
CREATE POLICY tacho_operations_update ON tacho_operations
  FOR UPDATE TO authenticated
  USING ((SELECT public.user_has_permission('editTachograph')))
  WITH CHECK ((SELECT public.user_has_permission('editTachograph')));
CREATE POLICY tacho_operations_delete ON tacho_operations
  FOR DELETE TO authenticated
  USING ((SELECT public.user_has_permission('deleteTachograph')));

-- =====================================================
-- 6. Data API grants (required for tables created after 2026-10-30)
-- =====================================================
GRANT SELECT ON public.tacho_suppliers, public.tacho_operation_types,
                public.tacho_supplier_tariffs, public.tacho_operations TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.tacho_suppliers,
  public.tacho_operation_types,
  public.tacho_supplier_tariffs,
  public.tacho_operations
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.tacho_suppliers,
  public.tacho_operation_types,
  public.tacho_supplier_tariffs,
  public.tacho_operations
TO service_role;

GRANT USAGE, SELECT ON SEQUENCE
  public.tacho_suppliers_id_seq,
  public.tacho_operation_types_id_seq,
  public.tacho_supplier_tariffs_id_seq,
  public.tacho_operations_id_seq
TO authenticated, service_role;

COMMIT;
