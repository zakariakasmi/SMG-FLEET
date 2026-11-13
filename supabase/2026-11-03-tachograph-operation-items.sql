-- =====================================================
-- Tachograph module — multiple priced items per operation
-- =====================================================
-- One intervention can cover several billable lines (e.g. a repair + a
-- calibration), each with its own article and price:
--
--   tacho_operations        header (vehicle, supplier, date, delivery note)
--   tacho_operation_items   one row per article + its price
--
-- `tacho_operations.operation_type_id` stays as the *primary* article (first
-- line). It keeps the type filter and the due-date logic working unchanged.
-- `tacho_operations.price_paid` is the sum of the line prices, written by the
-- API — the source of truth for costs is the items table.
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tacho_operation_items (
  id SERIAL PRIMARY KEY,
  operation_id INTEGER NOT NULL REFERENCES tacho_operations(id) ON DELETE CASCADE,
  operation_type_id INTEGER NOT NULL REFERENCES tacho_operation_types(id) ON DELETE RESTRICT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tacho_operation_items_operation
  ON tacho_operation_items(operation_id);
CREATE INDEX IF NOT EXISTS idx_tacho_operation_items_type
  ON tacho_operation_items(operation_type_id);

-- =====================================================
-- RLS — same model as the rest of the module
-- =====================================================
ALTER TABLE tacho_operation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tacho_operation_items_read ON tacho_operation_items;
DROP POLICY IF EXISTS tacho_operation_items_insert ON tacho_operation_items;
DROP POLICY IF EXISTS tacho_operation_items_update ON tacho_operation_items;
DROP POLICY IF EXISTS tacho_operation_items_delete ON tacho_operation_items;

CREATE POLICY tacho_operation_items_read ON tacho_operation_items
  FOR SELECT TO authenticated USING (true);
-- Editing an operation rewrites its lines, so edit-only users must be able to
-- insert/replace them as well (the header update is what they are allowed to do).
CREATE POLICY tacho_operation_items_insert ON tacho_operation_items
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.user_has_permission('addTachograph'))
    OR (SELECT public.user_has_permission('editTachograph'))
  );
CREATE POLICY tacho_operation_items_update ON tacho_operation_items
  FOR UPDATE TO authenticated
  USING ((SELECT public.user_has_permission('editTachograph')))
  WITH CHECK ((SELECT public.user_has_permission('editTachograph')));
CREATE POLICY tacho_operation_items_delete ON tacho_operation_items
  FOR DELETE TO authenticated
  USING (
    (SELECT public.user_has_permission('deleteTachograph'))
    OR (SELECT public.user_has_permission('editTachograph'))
  );

-- =====================================================
-- Data API grants
-- =====================================================
GRANT SELECT ON public.tacho_operation_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tacho_operation_items TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tacho_operation_items_id_seq TO authenticated, service_role;

COMMIT;
