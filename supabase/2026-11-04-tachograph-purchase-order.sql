-- =====================================================
-- Tachograph module — purchase order number
-- =====================================================
-- The supplier invoice/book is referenced by two documents: the delivery note
-- (`reference`) and the purchase order the intervention was ordered on. Both
-- are free text and both are searchable from the operations list.
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =====================================================

BEGIN;

ALTER TABLE tacho_operations
  ADD COLUMN IF NOT EXISTS purchase_order TEXT;

COMMENT ON COLUMN tacho_operations.purchase_order IS 'Bon de commande number';

COMMIT;
