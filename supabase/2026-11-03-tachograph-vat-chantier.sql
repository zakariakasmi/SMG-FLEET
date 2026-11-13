-- =====================================================
-- Tachograph module — VAT (TVA), TTC totals and chantier
-- =====================================================
-- Line prices in `tacho_operation_items` are amounts HT. The operation header
-- keeps their sum in `price_paid` (HT) and the VAT rate applied to it:
--
--   price_paid    total HT (sum of the article lines, written by the API)
--   vat_rate      VAT percentage, 20 by default
--   vat_amount    generated: price_paid * vat_rate / 100
--   total_ttc     generated: price_paid + vat_amount
--
-- Generated columns keep the TTC figures consistent for reporting without the
-- app having to write (and could forget to update) derived values. They stay
-- NULL while the operation has no price.
--
-- `chantier` is the worksite the intervention was done for. It is free text:
-- the form suggests the values already used, and the list can be filtered on it.
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =====================================================

BEGIN;

ALTER TABLE tacho_operations
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 20
    CHECK (vat_rate >= 0);

ALTER TABLE tacho_operations
  ADD COLUMN IF NOT EXISTS chantier TEXT;

-- How many articles an operation carries, for the nested-lines summary.
ALTER TABLE tacho_operations
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12, 2)
    GENERATED ALWAYS AS (ROUND(price_paid * vat_rate / 100, 2)) STORED;

ALTER TABLE tacho_operations
  ADD COLUMN IF NOT EXISTS total_ttc NUMERIC(12, 2)
    GENERATED ALWAYS AS (price_paid + ROUND(price_paid * vat_rate / 100, 2)) STORED;

CREATE INDEX IF NOT EXISTS idx_tacho_operations_chantier
  ON tacho_operations(chantier);

-- Line prices are HT; make that explicit for whoever reads the data next.
COMMENT ON COLUMN tacho_operation_items.price IS 'Line price, amount HT';
COMMENT ON COLUMN tacho_operations.price_paid IS 'Operation total HT (sum of the article lines)';

COMMIT;
