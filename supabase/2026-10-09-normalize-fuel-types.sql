-- Bring vehicle fuel types back in sync with the fuel_types reference table.
--
-- Import used to write only the free-text vehicles.fuel_type column (lowercased)
-- and never set fuel_type_id, so imported vehicles drifted off the reference
-- (Settings counts by fuel_type_id). This normalises the existing rows and links
-- them. Idempotent: safe to re-run.

-- 1. Ensure every distinct vehicle fuel_type exists in the reference table.
INSERT INTO fuel_types (name)
SELECT DISTINCT initcap(trim(v.fuel_type))
FROM vehicles v
WHERE v.fuel_type IS NOT NULL
  AND trim(v.fuel_type) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM fuel_types ft WHERE lower(ft.name) = lower(trim(v.fuel_type))
  );

-- 2. Normalise the text column to the canonical reference name and backfill the FK.
UPDATE vehicles v
SET fuel_type_id = ft.id,
    fuel_type = ft.name
FROM fuel_types ft
WHERE lower(trim(v.fuel_type)) = lower(ft.name);
