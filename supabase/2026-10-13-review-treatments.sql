-- =====================================================
-- RTC Logistique — durable review treatments
-- =====================================================
-- The Missions module surfaces two data-quality queues (spec §11): expense lines
-- the parser could not itemize, and mission vehicles with no fleet/ledger link.
--
-- Re-importing replaces every mission / mission_vehicle / mission_expense row
-- (source='google_2025'), so an in-app fix would be wiped by the next import.
-- A treatment therefore has to live somewhere the import does not touch, and be
-- re-applied by the builder. This migration adds:
--
--   * mission_vehicles.line_no — stable row index inside its mission, so a
--     vehicle override can address one line of a multi-line mission.
--   * expense_overrides        — "this (om, date, column) really breaks down as
--     these (category, amount) lines". A single catch-all column can cover several
--     categories, so each key holds a SET of split lines, not one category.
--   * review_dismissals        — "this raw vehicle label is expected; stop asking".
--
-- (Vehicle assignments reuse the existing import_vehicle_overrides table, which
-- is already applied by buildLedgerImport.)

-- 1) stable line number ----------------------------------------------------
ALTER TABLE mission_vehicles ADD COLUMN IF NOT EXISTS line_no integer;

-- Backfill: the import inserts a mission's vehicles in sheet order, so id order
-- reproduces the original line numbering used by import_vehicle_overrides.
UPDATE mission_vehicles mv
   SET line_no = x.rn
  FROM (
    SELECT id, row_number() OVER (PARTITION BY mission_id ORDER BY id) AS rn
      FROM mission_vehicles
  ) x
 WHERE mv.id = x.id
   AND mv.line_no IS DISTINCT FROM x.rn;

-- 2) expense re-categorisation overrides (split sets) ----------------------
-- A catch-all column (Divers / Déplacement complémentaire) that the parser could
-- not itemize may really be several categories. Each override key therefore holds
-- N (category_code, amount) rows whose sum must equal the column's booked amount.
CREATE TABLE IF NOT EXISTS expense_overrides (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  om            varchar NOT NULL,
  date_depart   date    NOT NULL,
  source_column varchar NOT NULL,
  category_code varchar NOT NULL REFERENCES expense_categories(code),
  amount        numeric NOT NULL CHECK (amount > 0),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expense_overrides_key_idx
  ON expense_overrides (om, date_depart, source_column);

-- 3) review dismissals -----------------------------------------------------
CREATE TABLE IF NOT EXISTS review_dismissals (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       text NOT NULL,
  value      text NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);

-- 4) RLS + grants ----------------------------------------------------------
ALTER TABLE expense_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_dismissals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON expense_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON review_dismissals TO authenticated;

-- Reads ride along with the missions scope; writes need the import scope.
DROP POLICY IF EXISTS expense_overrides_read ON expense_overrides;
CREATE POLICY expense_overrides_read ON expense_overrides
  FOR SELECT TO authenticated USING ((SELECT public.user_has_permission('missions')));
DROP POLICY IF EXISTS expense_overrides_write ON expense_overrides;
CREATE POLICY expense_overrides_write ON expense_overrides
  FOR ALL TO authenticated
  USING ((SELECT public.user_has_permission('import')))
  WITH CHECK ((SELECT public.user_has_permission('import')));

DROP POLICY IF EXISTS review_dismissals_read ON review_dismissals;
CREATE POLICY review_dismissals_read ON review_dismissals
  FOR SELECT TO authenticated USING ((SELECT public.user_has_permission('missions')));
DROP POLICY IF EXISTS review_dismissals_write ON review_dismissals;
CREATE POLICY review_dismissals_write ON review_dismissals
  FOR ALL TO authenticated
  USING ((SELECT public.user_has_permission('import')))
  WITH CHECK ((SELECT public.user_has_permission('import')));
