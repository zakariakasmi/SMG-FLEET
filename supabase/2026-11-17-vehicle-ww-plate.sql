-- Migration: Add optional ww_plate column to vehicles table and expose it in vehicle_summary
-- Run this in your Supabase SQL Editor

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ww_plate VARCHAR(50);

CREATE OR REPLACE VIEW vehicle_summary AS
SELECT
  v.id,
  v.code,
  v.registration_plate,
  v.vehicle_type,
  v.type_id,
  vt.name AS type_name,
  v.brand,
  v.brand_id,
  b.name AS brand_name,
  v.fuel_type,
  v.fuel_type_id,
  ft.name AS fuel_type_name,
  v.purchase_date,
  v.status,
  v.notes,
  v.ptac,
  v.puissance_fiscale,
  v.category_id,
  vc.name AS category_name,
  COUNT(c.id) AS charge_count,
  COALESCE(SUM(c.amount), 0) AS total_charges,
  v.ww_plate
FROM vehicles v
LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
LEFT JOIN vehicle_types vt ON v.type_id = vt.id
LEFT JOIN brands b ON v.brand_id = b.id
LEFT JOIN fuel_types ft ON v.fuel_type_id = ft.id
LEFT JOIN charges c ON v.id = c.vehicle_id AND c.year = EXTRACT(YEAR FROM NOW())
GROUP BY v.id, v.code, v.registration_plate, v.vehicle_type, v.type_id, vt.name,
         v.brand, v.brand_id, b.name, v.fuel_type, v.fuel_type_id, ft.name,
         v.purchase_date, v.status, v.notes, v.ptac, v.puissance_fiscale,
         v.category_id, vc.name, v.ww_plate;

ALTER VIEW vehicle_summary SET (security_invoker = true);

CREATE OR REPLACE FUNCTION vehicle_summary_for_year(p_year int)
RETURNS SETOF vehicle_summary
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.code,
    v.registration_plate,
    v.vehicle_type,
    v.type_id,
    vt.name AS type_name,
    v.brand,
    v.brand_id,
    b.name AS brand_name,
    v.fuel_type,
    v.fuel_type_id,
    ft.name AS fuel_type_name,
    v.purchase_date,
    v.status,
    v.notes,
    v.ptac,
    v.puissance_fiscale,
    v.category_id,
    vc.name AS category_name,
    COUNT(c.id) AS charge_count,
    COALESCE(SUM(c.amount), 0) AS total_charges,
    v.ww_plate
  FROM vehicles v
  LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
  LEFT JOIN vehicle_types vt ON v.type_id = vt.id
  LEFT JOIN brands b ON v.brand_id = b.id
  LEFT JOIN fuel_types ft ON v.fuel_type_id = ft.id
  LEFT JOIN charges c ON v.id = c.vehicle_id AND c.year = p_year
  GROUP BY v.id, v.code, v.registration_plate, v.vehicle_type, v.type_id, vt.name,
           v.brand, v.brand_id, b.name, v.fuel_type, v.fuel_type_id, ft.name,
           v.purchase_date, v.status, v.notes, v.ptac, v.puissance_fiscale,
           v.category_id, vc.name, v.ww_plate;
$$;

GRANT EXECUTE ON FUNCTION vehicle_summary_for_year(int) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
