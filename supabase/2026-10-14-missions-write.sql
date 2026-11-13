-- =====================================================
-- RTC Logistique — manual mission authoring (write policies)
-- =====================================================
-- The Missions module started read-only: reads need the 'missions' scope and
-- every write rode on the 'import' scope (see 2026-10-09-rtc-logistique-rls.sql).
-- This migration lets app users author missions directly, with dedicated scopes
-- mirroring the vehicles pattern (addVehicles / editVehicles / deleteVehicles):
--
--   addMissions    -> INSERT a mission and its vehicles/expenses
--   editMissions   -> UPDATE/DELETE a mission's vehicles and expenses
--   deleteMissions -> DELETE a mission
--
-- The 'import' scope stays on every command so the ledger importer (which
-- replaces mission bodies on re-import) and the review-treatment flows keep
-- working unchanged.
--
-- Reads stay gated by the existing 'missions' scope; the write scopes are
-- additive — grant 'missions' alongside them so the page is reachable.
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =====================================================

-- Drop the old broad 'import-only' write policies (FOR ALL) for these tables.
DROP POLICY IF EXISTS missions_write         ON missions;
DROP POLICY IF EXISTS mission_vehicles_write ON mission_vehicles;
DROP POLICY IF EXISTS mission_expenses_write ON mission_expenses;
DROP POLICY IF EXISTS missions_insert         ON missions;
DROP POLICY IF EXISTS missions_update         ON missions;
DROP POLICY IF EXISTS missions_delete         ON missions;
DROP POLICY IF EXISTS mission_vehicles_insert ON mission_vehicles;
DROP POLICY IF EXISTS mission_vehicles_update ON mission_vehicles;
DROP POLICY IF EXISTS mission_vehicles_delete ON mission_vehicles;
DROP POLICY IF EXISTS mission_expenses_insert ON mission_expenses;
DROP POLICY IF EXISTS mission_expenses_update ON mission_expenses;
DROP POLICY IF EXISTS mission_expenses_delete ON mission_expenses;

-- ---- missions ----
CREATE POLICY missions_insert ON missions
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.user_has_permission('addMissions'))
    OR (SELECT public.user_has_permission('import'))
  );

CREATE POLICY missions_update ON missions
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.user_has_permission('editMissions'))
    OR (SELECT public.user_has_permission('import'))
  )
  WITH CHECK (
    (SELECT public.user_has_permission('editMissions'))
    OR (SELECT public.user_has_permission('import'))
  );

CREATE POLICY missions_delete ON missions
  FOR DELETE TO authenticated
  USING (
    (SELECT public.user_has_permission('deleteMissions'))
    OR (SELECT public.user_has_permission('import'))
  );

-- ---- mission_vehicles ----
-- INSERT also honors editMissions: an update replaces the mission's child graph,
-- so an editor re-inserts the vehicles/expenses.
CREATE POLICY mission_vehicles_insert ON mission_vehicles
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.user_has_permission('addMissions'))
    OR (SELECT public.user_has_permission('editMissions'))
    OR (SELECT public.user_has_permission('import'))
  );

CREATE POLICY mission_vehicles_update ON mission_vehicles
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.user_has_permission('editMissions'))
    OR (SELECT public.user_has_permission('import'))
  )
  WITH CHECK (
    (SELECT public.user_has_permission('editMissions'))
    OR (SELECT public.user_has_permission('import'))
  );

CREATE POLICY mission_vehicles_delete ON mission_vehicles
  FOR DELETE TO authenticated
  USING (
    (SELECT public.user_has_permission('editMissions'))
    OR (SELECT public.user_has_permission('import'))
  );

-- ---- mission_expenses ----
CREATE POLICY mission_expenses_insert ON mission_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.user_has_permission('addMissions'))
    OR (SELECT public.user_has_permission('editMissions'))
    OR (SELECT public.user_has_permission('import'))
  );

CREATE POLICY mission_expenses_update ON mission_expenses
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.user_has_permission('editMissions'))
    OR (SELECT public.user_has_permission('import'))
  )
  WITH CHECK (
    (SELECT public.user_has_permission('editMissions'))
    OR (SELECT public.user_has_permission('import'))
  );

CREATE POLICY mission_expenses_delete ON mission_expenses
  FOR DELETE TO authenticated
  USING (
    (SELECT public.user_has_permission('editMissions'))
    OR (SELECT public.user_has_permission('import'))
  );

-- Table privileges (Supabase default-privileges already grants these; kept
-- explicit and idempotent for databases where that was changed).
GRANT SELECT, INSERT, UPDATE, DELETE ON missions         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mission_vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mission_expenses TO authenticated;
