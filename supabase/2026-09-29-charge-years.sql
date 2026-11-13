-- Charge rows become year-aware so each (vehicle, charge type) can have one
-- amount per year. Existing rows take the year they were created.

-- 1. Add the year column
ALTER TABLE charges ADD COLUMN IF NOT EXISTS year INT;

-- 2. Backfill existing rows from their creation year
UPDATE charges SET year = EXTRACT(YEAR FROM created_at) WHERE year IS NULL;

-- 3. Prevent null years going forward
ALTER TABLE charges ALTER COLUMN year SET NOT NULL;

-- 4. Per-year uniqueness (replaces the cross-year dedup constraint)
ALTER TABLE charges DROP CONSTRAINT IF EXISTS charges_vehicle_charge_type_unique;
ALTER TABLE charges
  ADD CONSTRAINT charges_vehicle_charge_type_year_unique
  UNIQUE (vehicle_id, charge_type_id, year);

-- 5. Speed up year-filtered queries (dashboard, renew)
CREATE INDEX IF NOT EXISTS idx_charges_year ON charges(year);