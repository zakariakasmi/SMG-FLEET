-- =====================================================
-- Phase 1 — RLS + ADMIN / STANDARD_USER authorization
--
-- Idempotent and NON-DESTRUCTIVE. Safe to re-run in the
-- Supabase SQL editor. Adds (never removes) schema objects
-- and replaces the role-blind "any authenticated user can
-- write everything" policies with permission-scoped ones.
--
-- Policy model mirrors src/context/AuthContext.jsx can():
--   role = 'admin'                -> full access
--   STANDARD users               -> SELECT everywhere, writes
--                                    gated by users.permissions
-- The import flow upserts vehicles/charges, so INSERT and
-- UPDATE on those tables also honor the 'import' scope.
-- =====================================================

BEGIN;

-- =====================================================
-- 0. Helper: user_has_permission(scope)
--    SECURITY DEFINER so it can read public.users while
--    being evaluated from RLS policies on other tables.
-- =====================================================
CREATE OR REPLACE FUNCTION public.user_has_permission(p_scope text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND (role = 'admin' OR p_scope = ANY(permissions))
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_permission(text) TO authenticated;

-- =====================================================
-- 1. BRANDS lookup table (idempotent, seed from live)
-- =====================================================
CREATE TABLE IF NOT EXISTS brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO brands (name) VALUES
  ('MAN'), ('IVECO'), ('SHACMAN'), ('MITSUBISHI'),
  ('SINOTRUK'), ('SITRAK'), ('RENAULT')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. Vehicles -> lookup FKs (idempotent; live already has them)
-- =====================================================
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS type_id INTEGER REFERENCES vehicle_types(id) ON DELETE SET NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type_id INTEGER REFERENCES fuel_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_type_id ON vehicles(type_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_brand_id ON vehicles(brand_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_fuel_type_id ON vehicles(fuel_type_id);

-- Backfill FK ids from the existing text columns (only where currently NULL).
UPDATE vehicles v SET type_id = vt.id
FROM vehicle_types vt
WHERE v.type_id IS NULL AND v.vehicle_type = vt.name;

UPDATE vehicles v SET brand_id = b.id
FROM brands b
WHERE v.brand_id IS NULL AND v.brand = b.name;

UPDATE vehicles v SET fuel_type_id = ft.id
FROM fuel_types ft
WHERE v.fuel_type_id IS NULL AND v.fuel_type = ft.name;

-- =====================================================
-- 3. vehicle_summary view (sync with live definition)
-- =====================================================
CREATE OR REPLACE VIEW vehicle_summary AS
SELECT
  v.id,
  v.code,
  v.registration_plate,
  v.vehicle_type,
  v.type_id,
  vt.name AS type_name,
  v.brand,
  v.brand_id,
  b.name AS brand_name,
  v.fuel_type,
  v.fuel_type_id,
  ft.name AS fuel_type_name,
  v.purchase_date,
  v.status,
  v.notes,
  v.ptac,
  v.puissance_fiscale,
  v.category_id,
  vc.name AS category_name,
  COUNT(c.id) AS charge_count,
  COALESCE(SUM(c.amount), 0) AS total_charges
FROM vehicles v
LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
LEFT JOIN vehicle_types vt ON v.type_id = vt.id
LEFT JOIN brands b ON v.brand_id = b.id
LEFT JOIN fuel_types ft ON v.fuel_type_id = ft.id
LEFT JOIN charges c ON v.id = c.vehicle_id AND c.year = EXTRACT(YEAR FROM NOW())
GROUP BY v.id, v.code, v.registration_plate, v.vehicle_type, v.type_id, vt.name,
         v.brand, v.brand_id, b.name, v.fuel_type, v.fuel_type_id, ft.name,
         v.purchase_date, v.status, v.notes, v.ptac, v.puissance_fiscale,
         v.category_id, vc.name;

ALTER VIEW vehicle_summary SET (security_invoker = true);

-- =====================================================
-- 4. RLS — permission-scoped policies
--    (drop the old role-blind policies, then recreate)
-- =====================================================
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- ---------- vehicles ----------
DROP POLICY IF EXISTS "Authenticated users full access" ON vehicles;
DROP POLICY IF EXISTS p_vehicles_select ON vehicles;
DROP POLICY IF EXISTS p_vehicles_insert ON vehicles;
DROP POLICY IF EXISTS p_vehicles_update ON vehicles;
DROP POLICY IF EXISTS p_vehicles_delete ON vehicles;

CREATE POLICY vehicles_read ON vehicles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY vehicles_insert ON vehicles
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.user_has_permission('addVehicles'))
    OR (SELECT public.user_has_permission('import'))
  );

CREATE POLICY vehicles_update ON vehicles
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.user_has_permission('editVehicles'))
    OR (SELECT public.user_has_permission('import'))
  )
  WITH CHECK (
    (SELECT public.user_has_permission('editVehicles'))
    OR (SELECT public.user_has_permission('import'))
  );

CREATE POLICY vehicles_delete ON vehicles
  FOR DELETE TO authenticated
  USING ((SELECT public.user_has_permission('deleteVehicles')));

-- ---------- charges ----------
DROP POLICY IF EXISTS "Authenticated users full access" ON charges;
DROP POLICY IF EXISTS p_charges_select ON charges;
DROP POLICY IF EXISTS p_charges_insert ON charges;
DROP POLICY IF EXISTS p_charges_update ON charges;
DROP POLICY IF EXISTS p_charges_delete ON charges;

CREATE POLICY charges_read ON charges
  FOR SELECT TO authenticated USING (true);

CREATE POLICY charges_insert ON charges
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.user_has_permission('addCharges'))
    OR (SELECT public.user_has_permission('import'))
  );

CREATE POLICY charges_update ON charges
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.user_has_permission('editCharges'))
    OR (SELECT public.user_has_permission('import'))
  )
  WITH CHECK (
    (SELECT public.user_has_permission('editCharges'))
    OR (SELECT public.user_has_permission('import'))
  );

CREATE POLICY charges_delete ON charges
  FOR DELETE TO authenticated
  USING ((SELECT public.user_has_permission('deleteCharges')));

-- ---------- vehicle_categories (manageTypes) ----------
DROP POLICY IF EXISTS "Authenticated users full access" ON vehicle_categories;
DROP POLICY IF EXISTS p_vehicle_categories_select ON vehicle_categories;
DROP POLICY IF EXISTS p_vehicle_categories_insert ON vehicle_categories;
DROP POLICY IF EXISTS p_vehicle_categories_update ON vehicle_categories;
DROP POLICY IF EXISTS p_vehicle_categories_delete ON vehicle_categories;

CREATE POLICY vehicle_categories_read ON vehicle_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY vehicle_categories_write ON vehicle_categories
  FOR ALL TO authenticated
  USING ((SELECT public.user_has_permission('manageTypes')))
  WITH CHECK ((SELECT public.user_has_permission('manageTypes')));

-- ---------- charge_types (manageTypes) ----------
DROP POLICY IF EXISTS "Authenticated users read access" ON charge_types;
DROP POLICY IF EXISTS p_charge_types_select ON charge_types;
DROP POLICY IF EXISTS p_charge_types_insert ON charge_types;
DROP POLICY IF EXISTS p_charge_types_update ON charge_types;
DROP POLICY IF EXISTS p_charge_types_delete ON charge_types;

CREATE POLICY charge_types_read ON charge_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY charge_types_write ON charge_types
  FOR ALL TO authenticated
  USING ((SELECT public.user_has_permission('manageTypes')))
  WITH CHECK ((SELECT public.user_has_permission('manageTypes')));

-- ---------- vehicle_types (manageTypes) ----------
DROP POLICY IF EXISTS p_vehicle_types_select ON vehicle_types;
DROP POLICY IF EXISTS p_vehicle_types_insert ON vehicle_types;
DROP POLICY IF EXISTS p_vehicle_types_update ON vehicle_types;
DROP POLICY IF EXISTS p_vehicle_types_delete ON vehicle_types;

CREATE POLICY vehicle_types_read ON vehicle_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY vehicle_types_write ON vehicle_types
  FOR ALL TO authenticated
  USING ((SELECT public.user_has_permission('manageTypes')))
  WITH CHECK ((SELECT public.user_has_permission('manageTypes')));

-- ---------- fuel_types (manageTypes) ----------
DROP POLICY IF EXISTS p_fuel_types_select ON fuel_types;
DROP POLICY IF EXISTS p_fuel_types_insert ON fuel_types;
DROP POLICY IF EXISTS p_fuel_types_update ON fuel_types;
DROP POLICY IF EXISTS p_fuel_types_delete ON fuel_types;

CREATE POLICY fuel_types_read ON fuel_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY fuel_types_write ON fuel_types
  FOR ALL TO authenticated
  USING ((SELECT public.user_has_permission('manageTypes')))
  WITH CHECK ((SELECT public.user_has_permission('manageTypes')));

-- ---------- brands (manageTypes) ----------
DROP POLICY IF EXISTS p_brands_select ON brands;
DROP POLICY IF EXISTS p_brands_insert ON brands;
DROP POLICY IF EXISTS p_brands_update ON brands;
DROP POLICY IF EXISTS p_brands_delete ON brands;

CREATE POLICY brands_read ON brands
  FOR SELECT TO authenticated USING (true);

CREATE POLICY brands_write ON brands
  FOR ALL TO authenticated
  USING ((SELECT public.user_has_permission('manageTypes')))
  WITH CHECK ((SELECT public.user_has_permission('manageTypes')));

-- ---------- import_logs (all authenticated log/read; admin manages) ----------
DROP POLICY IF EXISTS "Authenticated users full access" ON import_logs;
DROP POLICY IF EXISTS p_import_logs_select ON import_logs;
DROP POLICY IF EXISTS p_import_logs_insert ON import_logs;
DROP POLICY IF EXISTS p_import_logs_update ON import_logs;
DROP POLICY IF EXISTS p_import_logs_delete ON import_logs;

CREATE POLICY import_logs_read ON import_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY import_logs_insert ON import_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY import_logs_admin_write ON import_logs
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY import_logs_admin_delete ON import_logs
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

COMMIT;