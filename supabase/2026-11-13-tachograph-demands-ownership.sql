-- =====================================================
-- Tachograph demands — per-user visibility (ownership)
-- =====================================================
-- A demand belongs to the person who raised it. By default a user only sees
-- the demands they created; the fleet-manager role is the new
-- `viewAllTachographDemands` permission (Settings → Users → Tachograph), which
-- shows every demand. Admins always have it.
--
-- The creator can also update their own demand, which is what lets the app
-- complete it automatically when the operation is logged.
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =====================================================

BEGIN;

-- 1. Ownership is recorded by the database, never trusted from the client.
ALTER TABLE tacho_demands
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 2. Visibility: own demands, or all demands with the fleet-manager permission.
DROP POLICY IF EXISTS tacho_demands_read ON tacho_demands;

CREATE POLICY tacho_demands_read ON tacho_demands
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR (SELECT public.user_has_permission('viewAllTachographDemands'))
  );

-- The lines follow their demand: no reading the vehicles of a demand that is
-- not visible.
DROP POLICY IF EXISTS tacho_demand_items_read ON tacho_demand_items;

CREATE POLICY tacho_demand_items_read ON tacho_demand_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM tacho_demands d
       WHERE d.id = tacho_demand_items.demand_id
         AND (
           d.created_by = auth.uid()
           OR (SELECT public.user_has_permission('viewAllTachographDemands'))
         )
    )
  );

-- 3. The creator maintains their own demand (status, operation link). Ownership
--    itself cannot be handed over.
DROP POLICY IF EXISTS tacho_demands_update ON tacho_demands;

CREATE POLICY tacho_demands_update ON tacho_demands
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR (SELECT public.user_has_permission('editTachograph'))
  )
  WITH CHECK (
    created_by = auth.uid()
    OR (SELECT public.user_has_permission('editTachograph'))
  );

COMMIT;
