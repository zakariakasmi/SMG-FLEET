-- =====================================================
-- Data API grants — adopt Supabase's post-Oct-30 default
-- =====================================================
-- On 2026-10-30 Supabase stops auto-granting Data API access to newly created
-- tables in "public" for existing projects. Existing tables keep whatever
-- grants they have. Every table created from that date on needs an explicit
-- GRANT or PostgREST/supabase-js/GraphQL answer with "permission denied".
--
-- The tables below are *not* at risk — they already carry grants and keep
-- them. This migration does two things instead:
--
--   1. Makes the current tables match the new default, so there is exactly one
--      privilege model going forward and nothing depends on the legacy grants
--      that are being retired.
--
--   2. Fixes a real over-grant. Before Oct 30, Supabase's default granted
--      anon the SAME privileges as authenticated:
--
--          DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--
--      i.e. anonymous callers could write, and TRUNCATE, every public table.
--      That is wider than intended. RLS is currently the only thing holding
--      the door shut (all 19 tables have it enabled), but a permissive policy
--      or a future ENABLE/ALTER slip would expose writes outright. The
--      post-Oct-30 default is the tighter, intended shape: anon reads only.
--
-- Target state, per the Supabase notice:
--
--     anon          -> SELECT
--     authenticated -> SELECT, INSERT, UPDATE, DELETE
--     service_role  -> SELECT, INSERT, UPDATE, DELETE
--
-- Writes stay gated by RLS: authenticated holds the table grants, but
-- user_has_permission(...) / is_admin() / auth.uid() policies decide whether
-- any given row is actually writable. Revoking anon's DML removes a redundant
-- second path to the same rows, it does not change what logged-in users can do.
--
-- Public API surface deliberately LEFT UNTOUCHED:
--   * Functions are granted per-migration with `REVOKE ALL ... FROM PUBLIC`
--     followed by an explicit GRANT (authenticate, create_app_user, is_admin,
--     user_has_permission, missions_search, ...). Functions are not covered by
--     the Oct-30 table change and are not re-granted here.
--   * anon keeps EXECUTE on the login/RPC entry points it needs; revoking
--     table DML does not affect function execution.
--   * The auth_* wrappers in the auth schema are a separate concern.
--
-- Views:
--   * mission_type_mapping and vehicle_summary are views, not tables, and are
--     not subject to the Oct-30 change. Both already run with
--     security_invoker=true, so the RLS of the underlying tables applies to
--     the caller. That is re-asserted below as a guard, because a view
--     recreated without it would silently run as its owner (postgres) and
--     bypass RLS entirely — a far larger hole than the grant question.
--   * They get SELECT for anon/authenticated only. The legacy default left
--     anon holding INSERT/UPDATE/DELETE on them, which is meaningless and
--     misleading for a view.
--
-- Idempotent: uses a catalog-driven loop and catches "role does not exist",
-- so it is safe to re-run in the SQL editor and safe on a fresh local
-- `supabase db reset`. To apply on a brand-new project where a table was
-- created without grants, run this same block, or add the three GRANTs to the
-- creating migration.
--
-- APPLIED 2026-10-21 to project gefkfbdmnlfsqqjxqtdn: parts 1-3 are live and
-- verified (anon = SELECT only on all 21 objects; authenticated/service_role =
-- SELECT/INSERT/UPDATE/DELETE; views stay security_invoker=true). Part 4 is
-- NOT applied and is left commented out — see its header, the default-ACL
-- problem is unresolved and needs a decision.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Tables and views in public — reset to the intended grants
-- =====================================================
-- Driven from the catalog rather than a hardcoded list so tables added later
-- are covered without editing this migration. ALTER DEFAULT PRIVILEGES at the
-- bottom is what keeps future tables from needing this at all.
DO $$
DECLARE
  r          record;
  obj        text;
  has_anon   boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon');
  has_auth   boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
  has_svc    boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role');
BEGIN
  FOR r IN
    SELECT c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm')   -- table, partitioned table, view, matview
    ORDER BY c.relname
  LOOP
    obj := format('public.%I', r.relname);

    -- Start from a clean slate. PUBLIC is the implicit grantee that gives
    -- every role these privileges; clearing it is what actually contains the
    -- anonymous path.
    EXECUTE format('REVOKE ALL ON %s FROM PUBLIC', obj);

    IF has_anon THEN
      EXECUTE format('REVOKE ALL ON %s FROM anon', obj);
    END IF;
    IF has_auth THEN
      EXECUTE format('REVOKE ALL ON %s FROM authenticated', obj);
    END IF;
    IF has_svc THEN
      EXECUTE format('REVOKE ALL ON %s FROM service_role', obj);
    END IF;

    -- anon: read-only, on both tables and views.
    IF has_anon THEN
      EXECUTE format('GRANT SELECT ON %s TO anon', obj);
    END IF;

    -- authenticated: full DML on tables; SELECT only on views/matviews, which
    -- are not updatable here and were never meaningfully writable.
    IF has_auth THEN
      IF r.relkind IN ('r', 'p') THEN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO authenticated', obj);
      ELSE
        EXECUTE format('GRANT SELECT ON %s TO authenticated', obj);
      END IF;
    END IF;

    -- service_role: bypasses RLS by design, so it needs the full set to be
    -- usable from server-side code and the dashboard.
    IF has_svc THEN
      IF r.relkind IN ('r', 'p') THEN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO service_role', obj);
      ELSE
        EXECUTE format('GRANT SELECT ON %s TO service_role', obj);
      END IF;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 2. Sequences — INSERT into an identity/serial table needs this
-- =====================================================
-- A table grant alone is not enough for `nextval()`. service_role and
-- authenticated both insert on these tables, so without USAGE their inserts
-- fail even though the table grant is present.
DO $$
DECLARE
  s        text;
  has_auth boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
  has_svc  boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role');
BEGIN
  FOR s IN
    SELECT format('%I.%I', n.nspname, c.relname)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    IF has_auth THEN
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated', s);
    END IF;
    IF has_svc THEN
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role', s);
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 3. Views — re-assert security_invoker
-- =====================================================
-- Existing state already has this set; the ALTER is a no-op here and exists
-- so the invariant is captured in a migration rather than relied on by
-- accident. A view without it runs as its owner and skips RLS on the base
-- tables, which would hand anon every row of missions.
DO $$
DECLARE
  v text;
BEGIN
  FOR v IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
  END LOOP;
END $$;

-- =====================================================
-- 4. Default privileges — NOT APPLIED, read this before running
-- =====================================================
-- This section is deliberately left commented out. An earlier version of this
-- migration ran it and it did not have the intended effect; running it as
-- written would give a false sense of security. See the notes below.
--
-- Observed on 2026-10-21 after attempting it:
--
--     select d.defaclrole::regrole::text, d.defaclobjtype, d.defaclacl
--     from pg_default_acl d
--     join pg_namespace n on n.oid = d.defaclnamespace
--     where n.nspname = 'public';
--
--     defaclrole      objtype  acl
--     postgres        r        {postgres=arwdDxtm/postgres, anon=arwdDxtm/postgres, ...}
--     postgres        S        {postgres=rwU/postgres,       anon=rwU/postgres, ...}
--     supabase_admin  r        {postgres=arwdDxtm/supabase_admin, anon=arwdDxtm/..., ...}
--     supabase_admin  S        {postgres=rwU/supabase_admin,  anon=rwU/supabase_admin, ...}
--
-- Two problems:
--
--   1. anon still reads arwdDxtm (INSERT, SELECT, UPDATE, DELETE, TRUNCATE,
--      REFERENCES, TRIGGER, MAINTAIN) on every new table. That is the exact
--      over-grant this migration exists to remove, and it is still the default
--      for anything created from now on.
--
--   2. There are TWO default-ACL owners. `ALTER DEFAULT PRIVILEGES` with no
--      FOR ROLE only affects objects created by the role that runs it
--      (postgres here). Objects created as supabase_admin — which is what the
--      dashboard and parts of the platform use — are governed by the separate
--      supabase_admin defaults, untouched by anything below. Fixing one owner
--      and not the other leaves the hole open depending on who creates the
--      table.
--
-- Note also that `postgres` on this project is NOT a superuser; the ALTER
-- DEFAULT PRIVILEGES statements returned success but made no visible change,
-- so their effect here cannot be trusted without re-verification.
--
-- The reliable fix for Oct 30 remains the one the notice recommends: state the
-- GRANTs explicitly in the migration that creates each table. That is
-- deterministic and does not depend on default-ACL ownership. Part 1 of this
-- file already covers every existing object; new migrations must carry their
-- own GRANTs.
--
-- If you do want defaults as a backstop, both owners must be addressed
-- separately and then verified, e.g.:
--
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT SELECT ON TABLES TO anon;
--   ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
--     GRANT SELECT ON TABLES TO anon;
--
-- ...and then re-run the pg_default_acl query above to confirm the anon entry
-- is `ar` (SELECT) and no longer `arwdDxtm`. Do not assume it worked.

COMMIT;

-- =====================================================
-- Post-run verification
-- =====================================================
-- Expect: anon -> SELECT only; authenticated/service_role -> the four DML
-- verbs on tables. Anything still showing DELETE/TRUNCATE/REFERENCES for anon
-- means the revoke did not take.
--
-- select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as privs
-- from information_schema.role_table_grants
-- where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
-- group by grantee, table_name
-- order by grantee, table_name;
--
-- And the anonymous path end-to-end, which should now be refused:
--   select * from public.missions limit 1;   -- as anon: allowed (RLS permitting)
--   delete from public.missions;             -- as anon: permission denied
--
-- Supabase also exposes a health check for exactly this on the dashboard
-- (Settings -> Data API) and via the linter:
--   get_advisors('security')
