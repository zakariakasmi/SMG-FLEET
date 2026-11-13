-- SMG Fleet Management System - Database Schema
-- Run this SQL in your Supabase SQL Editor
-- Synced with the live Supabase database (2026-09).

-- =====================================================
-- 0. EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. VEHICLE CATEGORIES
-- =====================================================
CREATE TABLE IF NOT EXISTS vehicle_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 2. CHARGE TYPES (Reference Table)
-- =====================================================
CREATE TABLE IF NOT EXISTS charge_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  frequency VARCHAR(50),
  due_date_type VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed charge types
INSERT INTO charge_types (name, display_name, frequency, due_date_type) VALUES
  ('visite_technique', 'Visite technique', '12_months', 'variable'),
  ('taxe_transport', 'Taxe transport', 'annual', 'fixed'),
  ('taxe_essieu', 'Taxe à l''essieu', 'annual', 'fixed'),
  ('chrono_tachygraphe', 'Chrono tachygraphe', '24_months', 'variable'),
  ('assurance', 'Assurance', 'annual', 'fixed')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 3. LOOKUP TABLES (brands, vehicle types, fuel types)
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

CREATE TABLE IF NOT EXISTS vehicle_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO vehicle_types (name) VALUES
  ('Benne'), ('Minibus'), ('Pickup'), ('Tracteur'),
  ('Malaxeur'), ('Camion plateau'), ('Camion Grue'),
  ('Camion Benne à ordures')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS fuel_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO fuel_types (name) VALUES
  ('Diesel'), ('Essence')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 4. VEHICLES
-- =====================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  registration_plate VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(100) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  fuel_type VARCHAR(50) NOT NULL,
  purchase_date DATE NOT NULL,
  category_id INTEGER REFERENCES vehicle_categories(id) ON DELETE SET NULL,
  type_id INTEGER REFERENCES vehicle_types(id) ON DELETE SET NULL,
  brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  fuel_type_id INTEGER REFERENCES fuel_types(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  ptac DECIMAL(10, 2),
  puissance_fiscale SMALLINT
);

CREATE INDEX IF NOT EXISTS idx_vehicles_code ON vehicles(code);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles(category_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_type_id ON vehicles(type_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_brand_id ON vehicles(brand_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_fuel_type_id ON vehicles(fuel_type_id);

-- =====================================================
-- 5. CHARGES
-- =====================================================
CREATE TABLE IF NOT EXISTS charges (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  charge_type_id INTEGER NOT NULL REFERENCES charge_types(id),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT charges_vehicle_charge_type_unique UNIQUE(vehicle_id, charge_type_id)
);

CREATE INDEX IF NOT EXISTS idx_charges_vehicle ON charges(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_charges_type ON charges(charge_type_id);

-- =====================================================
-- 6. IMPORT LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS import_logs (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255),
  total_rows INTEGER,
  added_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 7. USERS
-- Auth is handled by Supabase Auth (auth.users). Each app user
-- links to an auth.users account via auth_id (FK, referenced in
-- create_app_user()). There is NO password_hash column anymore.
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP DEFAULT NOW(),
  permissions TEXT[] DEFAULT '{}'::TEXT[],
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_key ON users(auth_id);

-- Seed admin row (login is provisioned in auth.users separately,
-- e.g. by re-running the 2026-09-15-auth-rls migration or create_app_user).
INSERT INTO users (username, email, display_name, role) VALUES
  ('admin', 'admin@smg.local', 'Administrateur', 'admin')
ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- 8. VIEWS
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
  vc.name as category_name,
  COUNT(c.id) as charge_count,
  COALESCE(SUM(c.amount), 0) as total_charges
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
-- 9. FUNCTIONS
-- =====================================================

-- vehicle_summary_for_year(p_year) — same rows as vehicle_summary but with the
-- charge aggregate scoped to the given year, so the vehicles list can follow the
-- global year selector (a view can't take a filter). Applied in
-- supabase/2026-09-30-vehicle-summary-for-year.sql.
CREATE OR REPLACE FUNCTION vehicle_summary_for_year(p_year int)
RETURNS SETOF vehicle_summary
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
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
  LEFT JOIN charges c ON v.id = c.vehicle_id AND c.year = p_year
  GROUP BY v.id, v.code, v.registration_plate, v.vehicle_type, v.type_id, vt.name,
           v.brand, v.brand_id, b.name, v.fuel_type, v.fuel_type_id, ft.name,
           v.purchase_date, v.status, v.notes, v.ptac, v.puissance_fiscale,
           v.category_id, vc.name;
$$;

GRANT EXECUTE ON FUNCTION vehicle_summary_for_year(int) TO authenticated, service_role;

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- is_admin() — reads the caller's JWT (auth.uid()), used by RLS policies
-- and the admin RPCs. Defined with CREATE OR REPLACE only (the RLS policies
-- on public.users depend on it).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- user_has_permission(scope) — used by RLS policies on fleet tables.
-- Returns true when the caller's JWT maps to a public.users row whose
-- role is 'admin' OR whose permissions[] contains the requested scope.
-- SECURITY DEFINER so policies can read public.users safely.
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

-- create_app_user(email, password, display_name, role, permissions, username)
-- Creates a matching auth.users + auth.identities row and the public.users
-- row. Admin only (verified via is_admin()).
DROP FUNCTION IF EXISTS public.create_app_user(text, text, text, text, text[], text);
DROP FUNCTION IF EXISTS public.create_app_user(text, text, text, text, text[]);

CREATE OR REPLACE FUNCTION public.create_app_user(
  p_email text,
  p_password text,
  p_display_name text DEFAULT NULL,
  p_role text DEFAULT 'user',
  p_permissions text[] DEFAULT '{}'::text[],
  p_username text DEFAULT NULL
)
RETURNS TABLE(
  id integer,
  auth_id uuid,
  username varchar,
  email varchar,
  display_name varchar,
  role varchar,
  permissions text[],
  created_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_auth_id uuid := gen_random_uuid();
  v_id integer;
  v_email text := lower(trim(p_email));
  v_username text := COALESCE(NULLIF(p_username, ''), split_part(v_email, '@', 1));
  v_wanted text[] := ARRAY[
    'instance_id','id','aud','role','email','encrypted_password',
    'email_confirmed_at','confirmation_token','recovery_token',
    'email_change_token_current','email_change_token_new',
    'email_change','phone_change',
    'phone_change_token','phone_change_token_new','reauthentication_token',
    'raw_app_meta_data','raw_user_meta_data','created_at','updated_at',
    'is_sso_user','is_anonymous'
  ];
  v_used text[];
  v_values text[];
  v_identity text;
  v_ident_wanted text[] := ARRAY[
    'id','user_id','identity_data','provider','provider_id',
    'last_sign_in_at','created_at','updated_at'
  ];
  v_ident_used text[];
  v_ident_values text[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT array_agg(column_name::text) INTO v_used
  FROM information_schema.columns
  WHERE table_schema = 'auth' AND table_name = 'users'
    AND column_name = ANY(v_wanted);

  SELECT array_agg(
    CASE c
      WHEN 'instance_id' THEN '''00000000-0000-0000-0000-000000000000''::uuid'
      WHEN 'id' THEN '''' || v_auth_id::text || '''::uuid'
      WHEN 'aud' THEN '''authenticated'''
      WHEN 'role' THEN '''authenticated'''
      WHEN 'email' THEN quote_literal(v_email)
      WHEN 'encrypted_password' THEN quote_literal(crypt(p_password, gen_salt('bf')))
      WHEN 'email_confirmed_at' THEN 'now()'
      WHEN 'confirmation_token' THEN ''''''
      WHEN 'recovery_token' THEN ''''''
      WHEN 'email_change_token_current' THEN ''''''
      WHEN 'email_change_token_new' THEN ''''''
      WHEN 'email_change' THEN ''''''
      WHEN 'phone_change' THEN ''''''
      WHEN 'phone_change_token' THEN ''''''
      WHEN 'phone_change_token_new' THEN ''''''
      WHEN 'reauthentication_token' THEN ''''''
      WHEN 'raw_app_meta_data' THEN '''{"provider":"email","providers":["email"]}''::jsonb'
      WHEN 'raw_user_meta_data' THEN '''{}''::jsonb'
      WHEN 'created_at' THEN 'now()'
      WHEN 'updated_at' THEN 'now()'
      WHEN 'is_sso_user' THEN 'false'
      WHEN 'is_anonymous' THEN 'false'
    END
  ) INTO v_values
  FROM unnest(v_used) c;

  EXECUTE format(
    'INSERT INTO auth.users (%s) VALUES (%s)',
    array_to_string(v_used, ', '),
    array_to_string(v_values, ', ')
  );

  v_identity := jsonb_build_object('sub', v_auth_id::text, 'user_id', v_auth_id::text, 'email', v_email)::text;

  SELECT array_agg(column_name::text) INTO v_ident_used
  FROM information_schema.columns
  WHERE table_schema = 'auth' AND table_name = 'identities'
    AND column_name = ANY(v_ident_wanted);

  SELECT array_agg(
    CASE c
      WHEN 'id' THEN '''' || gen_random_uuid()::text || '''::uuid'
      WHEN 'user_id' THEN '''' || v_auth_id::text || '''::uuid'
      WHEN 'identity_data' THEN quote_literal(v_identity) || '::jsonb'
      WHEN 'provider' THEN '''email'''
      WHEN 'provider_id' THEN quote_literal(v_email)
      WHEN 'last_sign_in_at' THEN 'now()'
      WHEN 'created_at' THEN 'now()'
      WHEN 'updated_at' THEN 'now()'
    END
  ) INTO v_ident_values
  FROM unnest(v_ident_used) c;

  EXECUTE format(
    'INSERT INTO auth.identities (%s) VALUES (%s)',
    array_to_string(v_ident_used, ', '),
    array_to_string(v_ident_values, ', ')
  );

  INSERT INTO users (username, email, auth_id, display_name, role, permissions)
  VALUES (
    v_username,
    v_email,
    v_auth_id,
    COALESCE(NULLIF(p_display_name, ''), v_username),
    COALESCE(NULLIF(p_role, ''), 'user'),
    COALESCE(p_permissions, '{}'::text[])
  )
  RETURNING users.id INTO v_id;

  RETURN QUERY
  SELECT u.id, u.auth_id, u.username, u.email, u.display_name, u.role, u.permissions, u.created_at
  FROM users u
  WHERE u.id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_app_user(text, text, text, text, text[], text) TO anon, authenticated;

-- update_own_profile(display_name)
-- The ONLY channel through which a user edits their own row. Scoped to the
-- caller via auth.uid() (never trusts a passed user id) and touches nothing
-- but display_name — role/permissions cannot be changed by the owner.
DROP FUNCTION IF EXISTS public.update_own_profile(text);

CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_display_name text
)
RETURNS TABLE(
  id integer,
  username varchar,
  email varchar,
  auth_id uuid,
  display_name varchar,
  role varchar,
  permissions text[],
  created_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
BEGIN
  UPDATE users
  SET display_name = NULLIF(trim(p_display_name), '')
  WHERE auth_id = auth.uid()
  RETURNING users.id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN QUERY
  SELECT u.id, u.username, u.email, u.auth_id, u.display_name, u.role, u.permissions, u.created_at
  FROM users u
  WHERE u.id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_own_profile(text) TO authenticated;

-- set_app_user_password(user_id, new_password)
DROP FUNCTION IF EXISTS public.set_app_user_password(integer, text);

CREATE OR REPLACE FUNCTION public.set_app_user_password(
  p_user_id integer,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_auth_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT auth_id INTO v_auth_id FROM users WHERE id = p_user_id;
  IF v_auth_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = v_auth_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_app_user_password(integer, text) TO anon, authenticated;

-- delete_app_user(user_id)
DROP FUNCTION IF EXISTS public.delete_app_user(integer);

CREATE OR REPLACE FUNCTION public.delete_app_user(
  p_user_id integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT auth_id INTO v_auth_id FROM users WHERE id = p_user_id;
  IF v_auth_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM users WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = v_auth_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_app_user(integer) TO anon, authenticated;

-- =====================================================
-- 10. UPDATED_AT TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_charges_updated_at ON charges;
CREATE TRIGGER update_charges_updated_at
  BEFORE UPDATE ON charges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON vehicle_categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON vehicle_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 11. ROW-LEVEL SECURITY (RLS)
-- ADMIN / STANDARD_USER authorization. Mirrors src/context/AuthContext.jsx
-- can(): role 'admin' -> full access; otherwise users.permissions[] scopes.
-- Reads are open to any authenticated user (Dashboard has no scope guard);
-- writes on fleet tables require the matching scope. The import flow
-- upserts vehicles/charges, so those INSERT/UPDATE policies also honor the
-- 'import' scope. Lookup tables are managed via 'manageTypes'.
-- =====================================================
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- vehicles
DROP POLICY IF EXISTS "Authenticated users full access" ON vehicles;
DROP POLICY IF EXISTS p_vehicles_select ON vehicles;
DROP POLICY IF EXISTS p_vehicles_insert ON vehicles;
DROP POLICY IF EXISTS p_vehicles_update ON vehicles;
DROP POLICY IF EXISTS p_vehicles_delete ON vehicles;
CREATE POLICY vehicles_read ON vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY vehicles_insert ON vehicles FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_has_permission('addVehicles')) OR (SELECT public.user_has_permission('import')));
CREATE POLICY vehicles_update ON vehicles FOR UPDATE TO authenticated
  USING ((SELECT public.user_has_permission('editVehicles')) OR (SELECT public.user_has_permission('import')))
  WITH CHECK ((SELECT public.user_has_permission('editVehicles')) OR (SELECT public.user_has_permission('import')));
CREATE POLICY vehicles_delete ON vehicles FOR DELETE TO authenticated
  USING ((SELECT public.user_has_permission('deleteVehicles')));

-- charges
DROP POLICY IF EXISTS "Authenticated users full access" ON charges;
DROP POLICY IF EXISTS p_charges_select ON charges;
DROP POLICY IF EXISTS p_charges_insert ON charges;
DROP POLICY IF EXISTS p_charges_update ON charges;
DROP POLICY IF EXISTS p_charges_delete ON charges;
CREATE POLICY charges_read ON charges FOR SELECT TO authenticated USING (true);
CREATE POLICY charges_insert ON charges FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_has_permission('addCharges')) OR (SELECT public.user_has_permission('import')));
CREATE POLICY charges_update ON charges FOR UPDATE TO authenticated
  USING ((SELECT public.user_has_permission('editCharges')) OR (SELECT public.user_has_permission('import')))
  WITH CHECK ((SELECT public.user_has_permission('editCharges')) OR (SELECT public.user_has_permission('import')));
CREATE POLICY charges_delete ON charges FOR DELETE TO authenticated
  USING ((SELECT public.user_has_permission('deleteCharges')));

-- vehicle_categories
DROP POLICY IF EXISTS "Authenticated users full access" ON vehicle_categories;
DROP POLICY IF EXISTS p_vehicle_categories_select ON vehicle_categories;
DROP POLICY IF EXISTS p_vehicle_categories_insert ON vehicle_categories;
DROP POLICY IF EXISTS p_vehicle_categories_update ON vehicle_categories;
DROP POLICY IF EXISTS p_vehicle_categories_delete ON vehicle_categories;
CREATE POLICY vehicle_categories_read ON vehicle_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY vehicle_categories_write ON vehicle_categories FOR ALL TO authenticated
  USING ((SELECT public.user_has_permission('manageTypes')))
  WITH CHECK ((SELECT public.user_has_permission('manageTypes')));

-- charge_types
DROP POLICY IF EXISTS "Authenticated users read access" ON charge_types;
DROP POLICY IF EXISTS p_charge_types_select ON charge_types;
DROP POLICY IF EXISTS p_charge_types_insert ON charge_types;
DROP POLICY IF EXISTS p_charge_types_update ON charge_types;
DROP POLICY IF EXISTS p_charge_types_delete ON charge_types;
CREATE POLICY charge_types_read ON charge_types FOR SELECT TO authenticated USING (true);
CREATE POLICY charge_types_write ON charge_types FOR ALL TO authenticated
  USING ((SELECT public.user_has_permission('manageTypes')))
  WITH CHECK ((SELECT public.user_has_permission('manageTypes')));

-- vehicle_types
DROP POLICY IF EXISTS p_vehicle_types_select ON vehicle_types;
DROP POLICY IF EXISTS p_vehicle_types_insert ON vehicle_types;
DROP POLICY IF EXISTS p_vehicle_types_update ON vehicle_types;
DROP POLICY IF EXISTS p_vehicle_types_delete ON vehicle_types;
CREATE POLICY vehicle_types_read ON vehicle_types FOR SELECT TO authenticated USING (true);
CREATE POLICY vehicle_types_write ON vehicle_types FOR ALL TO authenticated
  USING ((SELECT public.user_has_permission('manageTypes')))
  WITH CHECK ((SELECT public.user_has_permission('manageTypes')));

-- fuel_types
DROP POLICY IF EXISTS p_fuel_types_select ON fuel_types;
DROP POLICY IF EXISTS p_fuel_types_insert ON fuel_types;
DROP POLICY IF EXISTS p_fuel_types_update ON fuel_types;
DROP POLICY IF EXISTS p_fuel_types_delete ON fuel_types;
CREATE POLICY fuel_types_read ON fuel_types FOR SELECT TO authenticated USING (true);
CREATE POLICY fuel_types_write ON fuel_types FOR ALL TO authenticated
  USING ((SELECT public.user_has_permission('manageTypes')))
  WITH CHECK ((SELECT public.user_has_permission('manageTypes')));

-- brands
DROP POLICY IF EXISTS p_brands_select ON brands;
DROP POLICY IF EXISTS p_brands_insert ON brands;
DROP POLICY IF EXISTS p_brands_update ON brands;
DROP POLICY IF EXISTS p_brands_delete ON brands;
CREATE POLICY brands_read ON brands FOR SELECT TO authenticated USING (true);
CREATE POLICY brands_write ON brands FOR ALL TO authenticated
  USING ((SELECT public.user_has_permission('manageTypes')))
  WITH CHECK ((SELECT public.user_has_permission('manageTypes')));

-- import_logs (all authenticated can log/read; admin manages)
DROP POLICY IF EXISTS "Authenticated users full access" ON import_logs;
DROP POLICY IF EXISTS p_import_logs_select ON import_logs;
DROP POLICY IF EXISTS p_import_logs_insert ON import_logs;
DROP POLICY IF EXISTS p_import_logs_update ON import_logs;
DROP POLICY IF EXISTS p_import_logs_delete ON import_logs;
CREATE POLICY import_logs_read ON import_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY import_logs_insert ON import_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY import_logs_admin_write ON import_logs FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY import_logs_admin_delete ON import_logs FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- users (own row SELECT + admin full; no INSERT policy — creation goes
-- through the SECURITY DEFINER create_app_user() RPC)
--
-- Scoped TO authenticated explicitly. These were previously TO public, which
-- reads as anonymous access even though every expression keys off auth.uid()
-- / is_admin() and an anonymous caller can never satisfy them. Naming the
-- role makes the intent legible and stops the policy from depending on anon
-- lacking a table grant.
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users
  FOR SELECT TO authenticated USING (auth.uid() = auth_id OR public.is_admin());
DROP POLICY IF EXISTS users_admin_update ON users;
CREATE POLICY users_admin_update ON users
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS users_admin_delete ON users;
CREATE POLICY users_admin_delete ON users
  FOR DELETE TO authenticated USING (public.is_admin());

-- =====================================================
-- Data API grants
-- =====================================================
-- Supabase used to grant the Data API roles access to every new table in
-- "public" implicitly. From 2026-10-30 that stops, so grants have to be stated.
-- Without these, PostgREST/supabase-js/GraphQL answer "permission denied" —
-- rebuilding from this file on a fresh project (or a local `db reset`) would
-- produce a database no client can reach.
--
-- The roles are deliberately NOT symmetrical:
--
--   anon          SELECT only. Anonymous callers read; they never write. The
--                 legacy default also handed anon INSERT/UPDATE/DELETE and
--                 TRUNCATE, leaving RLS as the sole barrier to anonymous
--                 writes. Narrowing to SELECT removes that second path.
--   authenticated SELECT, INSERT, UPDATE, DELETE. RLS still decides per row
--                 via user_has_permission()/is_admin()/auth.uid(); the table
--                 grant only makes the attempt reach the policy instead of
--                 failing at the privilege check.
--   service_role  SELECT, INSERT, UPDATE, DELETE. Bypasses RLS by design and
--                 backs server-side code and the dashboard.
--
-- PostgreSQL checks table privileges before row-level policies, so a missing
-- grant here looks identical to a policy denial in the API response. Both
-- layers are needed: grants admit the caller, policies filter the rows.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Inserts into identity/serial columns call nextval(), which is a SEQUENCE
-- privilege and not covered by the table grant above.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Apply the same shape to tables/sequences created later, so the next
-- CREATE TABLE does not silently land without Data API access.
--
-- CAVEAT (verified 2026-10-21): these did not take effect as hoped. anon still
-- receives arwdDxtm on new tables, and there are two default-ACL owners
-- (postgres and supabase_admin) — ALTER DEFAULT PRIVILEGES without FOR ROLE
-- only affects the role that runs it. Kept here for reference, but do not rely
-- on it: state GRANTs explicitly in each creating migration. See
-- 2026-10-21-data-api-grants.sql section 4 for the full notes.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role;