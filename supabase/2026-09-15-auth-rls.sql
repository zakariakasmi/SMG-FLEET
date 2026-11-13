-- SMG Fleet Management System
-- Security hardening: real Supabase Auth (JWT) + Row Level Security.
-- Closes the pipe: previously the anon key opened every table to anyone.
--
-- What this does:
--   1. Links each app user to an auth.users account (auth_id + email)
--   2. Copies existing bcrypt hashes into auth.users so passwords stay unchanged
--   3. Enables RLS: fleet tables -> authenticated only, users -> own row + admin
--   4. Replaces the old custom auth RPCs with admin-only RPCs
--
-- Run this SQL in your Supabase SQL Editor (postgres role).
-- NOTE: pgcrypto's crypt()/gen_salt() live in the `extensions` schema on this
-- project, so top-level statements call them schema-qualified.

-- =====================================================
-- 0. Ensure pgcrypto (extension lives in `extensions` schema here)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. Safety backfill: hash any remaining plaintext passwords
--    (idempotent — re-run of hashing migration not required)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'
  ) THEN
    UPDATE users
    SET password_hash = extensions.crypt(password_hash, extensions.gen_salt('bf'))
    WHERE password_hash IS NOT NULL
      AND password_hash NOT LIKE '$2a$%'
      AND password_hash NOT LIKE '$2b$%';
  END IF;
END $$;

-- =====================================================
-- 2. Add auth_id + email to the users table
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_key ON users(auth_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_auth_id_fkey
      FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE users
SET email = username || '@smg.local'
WHERE email IS NULL;

-- =====================================================
-- 4. Migrate existing users into auth.users.
-- Passwords are unchanged (bcrypt hashes copied directly).
-- Default login becomes:  admin@smg.local / admin
--
-- The INSERT column list is built dynamically from the columns that
-- actually exist on this Supabase version — auth.users is owned by
-- supabase_auth_admin, so we cannot ALTER it, and older GoTrue schemas
-- lack some columns (e.g. phone_change_token_new).
-- =====================================================
DO $$
DECLARE
  r RECORD;
  v_auth_id uuid;
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
BEGIN
  -- skip on re-runs (password_hash is dropped after the first successful run)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'
  ) THEN
    RETURN;
  END IF;

  SELECT array_agg(column_name::text) INTO v_used
  FROM information_schema.columns
  WHERE table_schema = 'auth' AND table_name = 'users'
    AND column_name = ANY(v_wanted);

  FOR r IN SELECT id, email, password_hash FROM users WHERE auth_id IS NULL LOOP
    v_auth_id := gen_random_uuid();

    SELECT array_agg(
      CASE c
        WHEN 'instance_id' THEN '''00000000-0000-0000-0000-000000000000''::uuid'
        WHEN 'id' THEN '''' || v_auth_id::text || '''::uuid'
        WHEN 'aud' THEN '''authenticated'''
        WHEN 'role' THEN '''authenticated'''
        WHEN 'email' THEN quote_literal(lower(trim(r.email)))
        WHEN 'encrypted_password' THEN quote_literal(r.password_hash)
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

    UPDATE users
    SET auth_id = v_auth_id
    WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- =====================================================
-- 4c. Normalize auth.users token/change columns.
-- GoTrue scans several of these columns as non-nullable strings; a NULL
-- value makes password grant fail with HTTP 500 "Database error querying
-- schema" (sql: Scan error on column ...: converting NULL to string is
-- unsupported). Idempotent — safe to re-run.
-- =====================================================
DO $$
DECLARE
  col text;
  cols text[] := ARRAY[
    'confirmation_token','recovery_token','email_change_token_current',
    'email_change_token_new','email_change','phone_change',
    'phone_change_token','phone_change_token_new','reauthentication_token'
  ];
BEGIN
  FOREACH col IN ARRAY cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = col
    ) THEN
      BEGIN
        EXECUTE format(
          'UPDATE auth.users SET %I = '''' WHERE %I IS NULL',
          col, col
        );
      EXCEPTION
        WHEN insufficient_privilege THEN
          RAISE NOTICE 'Skipping %I on auth.users: no privilege', col;
      END;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 4b. Backfill auth.identities ('email' identity) for users that were
-- inserted into auth.users directly. The normal signup flow also creates
-- this row; without it, GoTrue's password grant can return HTTP 500.
-- =====================================================
DO $$
DECLARE
  r RECORD;
  v_uid uuid;
  v_email text;
  v_wanted text[] := ARRAY[
    'id','user_id','identity_data','provider','provider_id',
    'last_sign_in_at','created_at','updated_at'
  ];
  v_used text[];
  v_values text[];
  v_identity text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'identities'
  ) THEN
    SELECT array_agg(column_name::text) INTO v_used
    FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'identities'
      AND column_name = ANY(v_wanted);

    FOR r IN
      SELECT u.auth_id AS uid, u.email AS em
      FROM users u
      LEFT JOIN auth.identities i ON i.user_id = u.auth_id AND i.provider = 'email'
      WHERE i.id IS NULL
    LOOP
      v_uid := r.uid;
      v_email := r.em;
      v_identity := jsonb_build_object('sub', v_uid::text, 'user_id', v_uid::text, 'email', v_email)::text;

      SELECT array_agg(
        CASE c
          WHEN 'id' THEN '''' || gen_random_uuid()::text || '''::uuid'
          WHEN 'user_id' THEN '''' || v_uid::text || '''::uuid'
          WHEN 'identity_data' THEN quote_literal(v_identity) || '::jsonb'
          WHEN 'provider' THEN '''email'''
          WHEN 'provider_id' THEN quote_literal(v_email)
          WHEN 'last_sign_in_at' THEN 'now()'
          WHEN 'created_at' THEN 'now()'
          WHEN 'updated_at' THEN 'now()'
        END
      ) INTO v_values
      FROM unnest(v_used) c;

      EXECUTE format(
        'INSERT INTO auth.identities (%s) VALUES (%s)',
        array_to_string(v_used, ', '),
        array_to_string(v_values, ', ')
      );
    END LOOP;
  END IF;
END $$;

-- =====================================================
-- 5. Drop the password column — auth is handled by auth.users now
-- =====================================================
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- =====================================================
-- 5.1 is_admin() — used by RLS policies and admin RPCs.
-- Reads the caller's JWT (auth.uid()), NOT request params.
-- Defined here (AFTER the auth_id column exists) because it is a
-- LANGUAGE sql function, which PostgreSQL parses at creation time.
-- Uses CREATE OR REPLACE only (no DROP) because the RLS policies on
-- public.users depend on it; the signature never changes.
-- =====================================================
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

-- =====================================================
-- 6. RLS: fleet tables — authenticated role only
-- =====================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vehicles', 'charges', 'vehicle_categories',
    'charge_types', 'vehicle_types', 'fuel_types', 'import_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = format('p_%s_select', t)) THEN
      EXECUTE format('CREATE POLICY p_%s_select ON public.%I FOR SELECT USING (auth.role() = ''authenticated'')', t, t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = format('p_%s_insert', t)) THEN
      EXECUTE format('CREATE POLICY p_%s_insert ON public.%I FOR INSERT WITH CHECK (auth.role() = ''authenticated'')', t, t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = format('p_%s_update', t)) THEN
      EXECUTE format('CREATE POLICY p_%s_update ON public.%I FOR UPDATE USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')', t, t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = format('p_%s_delete', t)) THEN
      EXECUTE format('CREATE POLICY p_%s_delete ON public.%I FOR DELETE USING (auth.role() = ''authenticated'')', t, t);
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 7. RLS: users table — own row (SELECT only) + admin (full).
-- Non-admins CANNOT update/insert/delete users rows directly at the API
-- level; their profile edits go through update_own_profile() below,
-- which is scoped to the caller (auth.uid()) and can only change
-- display_name. Self privilege-escalation is therefore impossible.
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_select') THEN
    CREATE POLICY users_select ON public.users
      FOR SELECT USING (auth.uid() = auth_id OR public.is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_admin_update') THEN
    CREATE POLICY users_admin_update ON public.users
      FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_admin_delete') THEN
    CREATE POLICY users_admin_delete ON public.users
      FOR DELETE USING (public.is_admin());
  END IF;
END $$;

-- =====================================================
-- 8. Admin RPCs (SECURITY DEFINER — the client cannot write auth.users)
-- Each verifies the caller is an admin BEFORE doing anything.
-- =====================================================

-- create_app_user(email, password, display_name, role, permissions, username)
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
-- 9. Drop the obsolete custom auth RPCs.
-- Login is now handled by Supabase Auth (auth.signInWithPassword),
-- so neither the anon key nor these bypass functions exist anymore.
-- =====================================================
DROP FUNCTION IF EXISTS public.authenticate(text, text);
DROP FUNCTION IF EXISTS public.create_user(text, text, text, text, text[]);
DROP FUNCTION IF EXISTS public.change_password(integer, text, text);
DROP FUNCTION IF EXISTS public.set_password(integer, text);