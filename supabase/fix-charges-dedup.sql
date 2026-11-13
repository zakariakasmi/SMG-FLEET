-- 1. Remove duplicate charges (keep the oldest one per vehicle+charge_type)
DELETE FROM charges
WHERE id NOT IN (
  SELECT MIN(id)
  FROM charges
  GROUP BY vehicle_id, charge_type_id
);

-- 2. Add unique constraint to prevent future duplicates
ALTER TABLE charges ADD CONSTRAINT charges_vehicle_charge_type_unique UNIQUE (vehicle_id, charge_type_id);
