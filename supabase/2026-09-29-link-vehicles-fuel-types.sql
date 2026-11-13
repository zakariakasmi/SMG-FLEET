-- Link vehicles to the fuel_types reference table by matching fuel type name.
UPDATE vehicles v
SET fuel_type_id = f.id
FROM fuel_types f
WHERE v.fuel_type_id IS NULL
  AND lower(trim(v.fuel_type)) = lower(f.name);