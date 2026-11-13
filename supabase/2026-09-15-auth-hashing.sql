-- SMG Fleet Management System
-- Auth hardening: server-side bcrypt password hashing (replaces plaintext storage)
-- Run this SQL in your Supabase SQL Editor (postgres role).

-- =====================================================
-- 1. Enable pgcrypto for crypt() / gen_salt()
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 2. authenticate(username, password)
-- Returns the user row ONLY when credentials match.
-- The password is verified server-side with bcrypt so it
-- never leaves the database as plaintext logic.
-- =====================================================
DROP FUNCTION IF EXISTS public.authenticate(text, text);

CREATE OR REPLACE FUNCTION public.authenticate(
  p_username text,
  p_password text
)
RETURNS TABLE(
  id integer,
  username varchar,
  display_name varchar,
  role varchar,
  permissions text[],
  created_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, u.display_name, u.role, u.permissions, u.created_at
  FROM users u
  WHERE u.username = p_username
    AND u.password_hash = crypt(p_password, u.password_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION public.authenticate(text, text) TO anon, authenticated;

-- =====================================================
-- 3. create_user(...)
-- Creates a user and stores a bcrypt hash instead of the
-- raw password.
-- =====================================================
DROP FUNCTION IF EXISTS public.create_user(text, text, text, text, text[]);

CREATE OR REPLACE FUNCTION public.create_user(
  p_username text,
  p_password text,
  p_display_name text,
  p_role text,
  p_permissions text[]
)
RETURNS TABLE(
  id integer,
  username varchar,
  display_name varchar,
  role varchar,
  permissions text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id integer;
BEGIN
  INSERT INTO users (username, password_hash, display_name, role, permissions)
  VALUES (
    p_username,
    crypt(p_password, gen_salt('bf')),
    COALESCE(NULLIF(p_display_name, ''), p_username),
    COALESCE(NULLIF(p_role, ''), 'user'),
    p_permissions
  )
  RETURNING users.id INTO v_id;

  RETURN QUERY
  SELECT u.id, u.username, u.display_name, u.role, u.permissions
  FROM users u
  WHERE u.id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_user(text, text, text, text, text[]) TO anon, authenticated;

-- =====================================================
-- 4. change_password(user_id, current_password, new_password)
-- Verifies the current password server-side, then re-hashes.
-- Returns true on success, false when the current password is wrong.
-- =====================================================
DROP FUNCTION IF EXISTS public.change_password(integer, text, text);

CREATE OR REPLACE FUNCTION public.change_password(
  p_user_id integer,
  p_current_password text,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_matches boolean;
BEGIN
  SELECT (password_hash = crypt(p_current_password, password_hash))
    INTO v_matches
  FROM users
  WHERE id = p_user_id;

  IF COALESCE(v_matches, false) THEN
    UPDATE users
    SET password_hash = crypt(p_new_password, gen_salt('bf'))
    WHERE id = p_user_id;
  END IF;

  RETURN COALESCE(v_matches, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_password(integer, text, text) TO anon, authenticated;

-- =====================================================
-- 5. set_password(user_id, new_password)
-- Admin override: sets a new password without verifying the
-- current one. Used by the Settings user editor.
-- =====================================================
DROP FUNCTION IF EXISTS public.set_password(integer, text);

CREATE OR REPLACE FUNCTION public.set_password(
  p_user_id integer,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE users
  SET password_hash = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_user_id;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_password(integer, text) TO anon, authenticated;

-- =====================================================
-- 6. Backfill: hash any remaining plaintext passwords.
-- Idempotent — already-hashed rows (bcrypt format starts
-- with $2a$ / $2b$) are skipped, so re-running is safe.
-- =====================================================
UPDATE users
SET password_hash = crypt(password_hash, gen_salt('bf'))
WHERE password_hash IS NOT NULL
  AND password_hash NOT LIKE '$2a$%'
  AND password_hash NOT LIKE '$2b$%';