-- Year-parameterised fleet totals.
--
-- vehicle_summary is a view, so it cannot accept a filter and its charge
-- aggregate is pinned to EXTRACT(YEAR FROM NOW()). The vehicles list needs
-- the same totals for whichever year the global header selector points at,
-- so we expose the same row shape as a function taking the year as an
-- argument and call it via supabase.rpc('vehicle_summary_for_year', ...).

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
    COALESCE(SUM(c.amount), 0) AS total_charges
  FROM vehicles v
  LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
  LEFT JOIN vehicle_types vt ON v.type_id = vt.id
  LEFT JOIN brands b ON v.brand_id = b.id
  LEFT JOIN fuel_types ft ON v.fuel_type_id = ft.id
  LEFT JOIN charges c ON v.id = c.vehicle_id AND c.year = p_year
  GROUP BY v.id, v.code, v.registration_plate, v.vehicle_type, v.type_id, vt.name,
           v.brand, v.brand_id, b.name, v.fuel_type, v.fuel_type_id, ft.name,
           v.purchase_date, v.status, v.notes, v.ptac, v.puissance_fiscale,
           v.category_id, vc.name;
$$;

GRANT EXECUTE ON FUNCTION vehicle_summary_for_year(int) TO authenticated, service_role;

-- PostgREST caches its schema; make sure the new function is visible at once.
NOTIFY pgrst, 'reload schema';