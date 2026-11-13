-- Bring vehicle types back in sync with the vehicle_types reference table.
--
-- The app only ever wrote the free-text vehicles.vehicle_type column (lowercased
-- on import / autocompleted from a lowercased list) and never set vehicles.type_id,
-- so vehicles drifted off the reference table that Settings manages (Settings
-- counts vehicles by type_id -> vehicles). This normalises the text to the
-- canonical reference name and backfills the FK. Idempotent: safe to re-run.

-- 1. Ensure every distinct vehicle type in the fleet exists in the reference table.
INSERT INTO vehicle_types (name)
SELECT DISTINCT initcap(trim(v.vehicle_type))
FROM vehicles v
WHERE v.vehicle_type IS NOT NULL
  AND trim(v.vehicle_type) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM vehicle_types vt WHERE lower(vt.name) = lower(trim(v.vehicle_type))
  );

-- 2. Point type_id at the matching reference row and normalise the text column to
--    the canonical reference name (matched case-insensitively).
UPDATE vehicles v
SET type_id = vt.id,
    vehicle_type = vt.name
FROM vehicle_types vt
WHERE lower(trim(v.vehicle_type)) = lower(vt.name);
