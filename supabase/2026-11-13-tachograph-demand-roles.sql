-- =====================================================
-- Tachograph demands — requester role
-- =====================================================
-- A requester holds `addTachographDemands`: they send demands, correct them,
-- and withdraw their own. They never touch the operations book.
--
-- Before this migration, writing a demand required `addTachograph`, the same
-- scope that opens the operations page, so the two roles could not be split.
-- Here every write path accepts the demand scope as well, and ownership is
-- checked whenever the caller is not an operations user.
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =====================================================

BEGIN;

-- 1. Insert a demand: a requester or an operations user. The row is always
--    attributed to the caller — ownership is never taken from the client.
DROP POLICY IF EXISTS tacho_demands_insert ON tacho_demands;

CREATE POLICY tacho_demands_insert ON tacho_demands
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (SELECT public.user_has_permission('addTachographDemands'))
      OR (SELECT public.user_has_permission('addTachograph'))
    )
  );

-- 2. Update a demand: its creator while they still hold the demand scope, or
--    an operations user (logging the operation completes the demand, and that
--    operation may be logged by someone else).
DROP POLICY IF EXISTS tacho_demands_update ON tacho_demands;

CREATE POLICY tacho_demands_update ON tacho_demands
  FOR UPDATE TO authenticated
  USING (
    (
      created_by = auth.uid()
      AND (SELECT public.user_has_permission('addTachographDemands'))
    )
    OR (SELECT public.user_has_permission('addTachograph'))
    OR (SELECT public.user_has_permission('editTachograph'))
  )
  WITH CHECK (
    (
      created_by = auth.uid()
      AND (SELECT public.user_has_permission('addTachographDemands'))
    )
    OR (SELECT public.user_has_permission('addTachograph'))
    OR (SELECT public.user_has_permission('editTachograph'))
  );

-- 3. Withdraw a demand: its creator with the demand scope, or an operations
--    user allowed to delete operations.
DROP POLICY IF EXISTS tacho_demands_delete ON tacho_demands;

CREATE POLICY tacho_demands_delete ON tacho_demands
  FOR DELETE TO authenticated
  USING (
    (
      created_by = auth.uid()
      AND (SELECT public.user_has_permission('addTachographDemands'))
    )
    OR (SELECT public.user_has_permission('deleteTachograph'))
  );

-- 4. Demand lines. They are rewritten (delete + insert) whenever a demand is
--    edited, so a requester needs both on the lines of their own demand.
DROP POLICY IF EXISTS tacho_demand_items_insert ON tacho_demand_items;

CREATE POLICY tacho_demand_items_insert ON tacho_demand_items
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.user_has_permission('addTachograph'))
    OR (
      (SELECT public.user_has_permission('addTachographDemands'))
      AND EXISTS (
        SELECT 1
          FROM tacho_demands d
         WHERE d.id = tacho_demand_items.demand_id
           AND d.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS tacho_demand_items_update ON tacho_demand_items;

CREATE POLICY tacho_demand_items_update ON tacho_demand_items
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.user_has_permission('editTachograph'))
    OR (
      (SELECT public.user_has_permission('addTachographDemands'))
      AND EXISTS (
        SELECT 1
          FROM tacho_demands d
         WHERE d.id = tacho_demand_items.demand_id
           AND d.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    (SELECT public.user_has_permission('editTachograph'))
    OR (
      (SELECT public.user_has_permission('addTachographDemands'))
      AND EXISTS (
        SELECT 1
          FROM tacho_demands d
         WHERE d.id = tacho_demand_items.demand_id
           AND d.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS tacho_demand_items_delete ON tacho_demand_items;

CREATE POLICY tacho_demand_items_delete ON tacho_demand_items
  FOR DELETE TO authenticated
  USING (
    (SELECT public.user_has_permission('deleteTachograph'))
    OR (
      (SELECT public.user_has_permission('addTachographDemands'))
      AND EXISTS (
        SELECT 1
          FROM tacho_demands d
         WHERE d.id = tacho_demand_items.demand_id
           AND d.created_by = auth.uid()
      )
    )
  );

COMMIT;
