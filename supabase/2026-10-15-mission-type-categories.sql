-- =====================================================
-- RTC Logistique — mission vehicle "type" aligned to vehicle_categories
-- =====================================================
-- The missions module speaks the *category* vocabulary (Porte Chars,
-- Plateaux 12M, Voitures …) — that is what the mission form offers, what
-- mission_vehicles.vehicle_type_raw carries for the rows the ledger imported,
-- and what main-vehicle detection keys off. But the ledger's "Type Véhicule"
-- column is free text, so 39 distinct values landed in mission_vehicles and
-- only about a third of them are actual categories:
--
--     VOITURE ESCORT (588)   benne 18T (212)   BENNE (169)   PICKUP (166)
--     PORTE CHAR -40T (99)   TRANSPORT (65)    VOITURE (55)  CAMION GASOIL (17) …
--
-- This migration gives those values a single, editable mapping to a category
-- and stores the resolved category on the mission line.
--
-- Design notes:
--   * mission_vehicles.vehicle_type_raw is deliberately LEFT AS THE RAW LEDGER
--     TEXT. src/utils/missions.js mainVehicle() reads it to spot porte-char /
--     plateau (main vehicle) and escort lines; rewriting it to a category name
--     would silently break that (a "VOITURE ESCORT" row becomes just
--     "Voitures"). The canonical category therefore lives in a new column,
--     mission_vehicles.category_id, and is what the UI shows.
--   * Mapping precedence: an explicit alias (the wizard) beats an exact
--     category-name match, which beats the linked fleet vehicle's own category.
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. vehicle_type_aliases — "this ledger type text means that category"
--    raw_norm is always lower(btrim(original text)).
-- =====================================================
CREATE TABLE IF NOT EXISTS vehicle_type_aliases (
  raw_norm    text        PRIMARY KEY,
  category_id integer     NOT NULL REFERENCES vehicle_categories(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicle_type_aliases ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON vehicle_type_aliases TO authenticated;

DROP POLICY IF EXISTS vta_read ON vehicle_type_aliases;
CREATE POLICY vta_read ON vehicle_type_aliases
  FOR SELECT TO authenticated USING (true));

DROP POLICY IF EXISTS vta_insert ON vehicle_type_aliases;
CREATE POLICY vta_insert ON vehicle_type_aliases
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.user_has_permission('import'))
    OR (SELECT public.user_has_permission('manageTypes'))
    OR (SELECT public.user_has_permission('editMissions'))
  );

DROP POLICY IF EXISTS vta_update ON vehicle_type_aliases;
CREATE POLICY vta_update ON vehicle_type_aliases
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.user_has_permission('import'))
    OR (SELECT public.user_has_permission('manageTypes'))
    OR (SELECT public.user_has_permission('editMissions'))
  )
  WITH CHECK (
    (SELECT public.user_has_permission('import'))
    OR (SELECT public.user_has_permission('manageTypes'))
    OR (SELECT public.user_has_permission('editMissions'))
  );

DROP POLICY IF EXISTS vta_delete ON vehicle_type_aliases;
CREATE POLICY vta_delete ON vehicle_type_aliases
  FOR DELETE TO authenticated
  USING (
    (SELECT public.user_has_permission('import'))
    OR (SELECT public.user_has_permission('manageTypes'))
    OR (SELECT public.user_has_permission('editMissions'))
  );

-- =====================================================
-- 2. Resolved category on each mission line.
-- =====================================================
ALTER TABLE mission_vehicles ADD COLUMN IF NOT EXISTS
  category_id integer REFERENCES vehicle_categories(id);

CREATE INDEX IF NOT EXISTS mv_category_idx
  ON mission_vehicles (category_id) WHERE category_id IS NOT NULL;

-- =====================================================
-- 3. mission_vehicle_category_for(raw, vehicle) — the single source of truth
--    for the mapping, shared by the write trigger and the wizard.
--      1) explicit alias (what the operator chose)
--      2) the raw text already IS a category name (case-insensitive)
--      3) the linked fleet vehicle's own category
--      4) the "no type text" alias (raw_norm = '') — the bucket for lines the
--         ledger imported with an empty type and no linked vehicle. It is last
--         on purpose: a line whose vehicle knows its own category keeps it.
-- =====================================================
CREATE OR REPLACE FUNCTION public.mission_vehicle_category_for(
  p_raw       text,
  p_vehicle_id integer
) RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT a.category_id
       FROM vehicle_type_aliases a
      WHERE btrim(COALESCE(p_raw, '')) <> ''
        AND a.raw_norm = lower(btrim(p_raw))),
    (SELECT c.id
       FROM vehicle_categories c
      WHERE btrim(COALESCE(p_raw, '')) <> ''
        AND lower(c.name) = lower(btrim(p_raw))),
    (SELECT v.category_id
       FROM vehicles v
      WHERE v.id = p_vehicle_id),
    (SELECT a.category_id
       FROM vehicle_type_aliases a
      WHERE a.raw_norm = '')
  );
$$;

REVOKE ALL ON FUNCTION public.mission_vehicle_category_for(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mission_vehicle_category_for(text, integer) TO authenticated;

-- =====================================================
-- 4. Derive the category automatically on every write path (ledger import,
--    manual mission form, review treatments) so nothing has to remember it.
--    `UPDATE OF vehicle_type_raw, vehicle_id` means a wizard write that only
--    touches category_id is NOT recomputed out from under it.
-- =====================================================
CREATE OR REPLACE FUNCTION public.mission_vehicle_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.category_id := public.mission_vehicle_category_for(NEW.vehicle_type_raw, NEW.vehicle_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mv_category ON mission_vehicles;
CREATE TRIGGER trg_mv_category
  BEFORE INSERT OR UPDATE OF vehicle_type_raw, vehicle_id
  ON mission_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.mission_vehicle_category();

-- Backfill everything already imported. Idempotent: only fills unresolved rows.
UPDATE mission_vehicles mv
   SET category_id = public.mission_vehicle_category_for(mv.vehicle_type_raw, mv.vehicle_id)
 WHERE mv.category_id IS NULL;

-- =====================================================
-- 5. mission_type_mapping — one row per distinct raw type text, for the
--    mapping wizard (which is the "tell me which category this is" step).
-- =====================================================
-- `raw_norm` is '' (not NULL) for lines with no type text, so they group
-- together AND stay editable in the wizard.
CREATE OR REPLACE VIEW public.mission_type_mapping AS
SELECT
  COALESCE(lower(btrim(mv.vehicle_type_raw)), '')              AS raw_norm,
  max(mv.vehicle_type_raw)                                     AS sample,
  count(*)                                                     AS row_count,
  count(*) FILTER (WHERE mv.category_id IS NULL)                AS unresolved_rows,
  string_agg(DISTINCT vc.name, ', ' ORDER BY vc.name)          AS category_names,
  count(DISTINCT mv.category_id)                               AS category_count,
  max(a.category_id)                                           AS alias_category_id,
  max(ac.name)                                                 AS alias_category_name
FROM mission_vehicles mv
LEFT JOIN vehicle_categories vc ON vc.id = mv.category_id
LEFT JOIN vehicle_type_aliases a
       ON a.raw_norm = COALESCE(lower(btrim(mv.vehicle_type_raw)), '')
LEFT JOIN vehicle_categories ac ON ac.id = a.category_id
GROUP BY 1
ORDER BY count(*) DESC;

ALTER VIEW public.mission_type_mapping SET (security_invoker = true);

REVOKE ALL ON public.mission_type_mapping FROM PUBLIC;
GRANT SELECT ON public.mission_type_mapping TO authenticated;

-- =====================================================
-- 6. apply / clear — a single call so the wizard both records the mapping
--    and re-derives the rows it covers (existing rows would otherwise keep
--    whatever they were derived with until their next write).
--    SECURITY INVOKER: the caller's RLS (missions write + alias write) applies.
-- =====================================================
CREATE OR REPLACE FUNCTION public.apply_vehicle_type_alias(
  p_raw        text,
  p_category_id integer
) RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_raw   text := COALESCE(lower(btrim(p_raw)), '');
  v_count integer;
BEGIN
  -- '' is a valid key: it is the "no type text" bucket. Only an absent value
  -- is a programming error.
  IF p_raw IS NULL THEN
    RAISE EXCEPTION 'apply_vehicle_type_alias: type text is NULL';
  END IF;
  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'apply_vehicle_type_alias: category is required';
  END IF;

  INSERT INTO vehicle_type_aliases (raw_norm, category_id)
  VALUES (v_raw, p_category_id)
  ON CONFLICT (raw_norm) DO UPDATE
    SET category_id = EXCLUDED.category_id,
        updated_at  = now();

  UPDATE mission_vehicles mv
     SET category_id = p_category_id
   WHERE COALESCE(lower(btrim(mv.vehicle_type_raw)), '') = v_raw;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_vehicle_type_alias(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_vehicle_type_alias(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_vehicle_type_alias(p_raw text)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_raw   text := COALESCE(lower(btrim(p_raw)), '');
  v_count integer;
BEGIN
  IF p_raw IS NULL THEN
    RAISE EXCEPTION 'clear_vehicle_type_alias: type text is NULL';
  END IF;

  DELETE FROM vehicle_type_aliases WHERE raw_norm = v_raw;

  -- Re-derive from scratch (exact category name, else the linked vehicle, else
  -- the "no type text" bucket).
  UPDATE mission_vehicles mv
     SET category_id = public.mission_vehicle_category_for(mv.vehicle_type_raw, mv.vehicle_id)
   WHERE COALESCE(lower(btrim(mv.vehicle_type_raw)), '') = v_raw;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_vehicle_type_alias(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_vehicle_type_alias(text) TO authenticated;

-- =====================================================
-- 7. Operator decision: a line the ledger imported with NO type text at all and
--    no linked vehicle gets the "Divers" category. It is stored as the
--    raw_norm = '' alias so a ledger re-import lands on it again, and it sits
--    last in the precedence chain so a line whose vehicle knows its own
--    category keeps that category instead.
-- =====================================================
INSERT INTO vehicle_type_aliases (raw_norm, category_id)
SELECT '', c.id
  FROM vehicle_categories c
 WHERE lower(c.name) = 'divers'
ON CONFLICT (raw_norm) DO UPDATE SET category_id = EXCLUDED.category_id,
                                      updated_at  = now();

UPDATE mission_vehicles mv
   SET category_id = public.mission_vehicle_category_for(mv.vehicle_type_raw, mv.vehicle_id)
 WHERE mv.category_id IS NULL
   AND COALESCE(lower(btrim(mv.vehicle_type_raw)), '') = '';

-- =====================================================
-- 8. missions_search — expose the resolved category alongside the raw text so
--    the list / export / gendarmerie report show a category name instead of
--    free-text ledger noise. `vehicle_type_raw` keeps its meaning (the raw
--    ledger text) for main-vehicle and escort detection.
-- =====================================================
CREATE OR REPLACE FUNCTION public.missions_search(
  p_search      text    default '',
  p_from        date    default null,
  p_to          date    default null,
  p_gendarmerie boolean default null,
  p_vehicle     text    default '',
  p_driver      text    default ''
) RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', m.id,
    'om', m.om,
    'date_depart', m.date_depart,
    'depart', m.depart,
    'destination', m.destination,
    'a_travers', m.a_travers,
    'date_arriver', m.date_arriver,
    'date_reglement', m.date_reglement,
    'gendarmerie_required', m.gendarmerie_required,
    'mission_vehicles', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', mv.id,
        'vehicle_id', mv.vehicle_id,
        'ledger_vehicle_id', mv.ledger_vehicle_id,
        'vehicle_type_raw', mv.vehicle_type_raw,
        'category', CASE WHEN vc.id IS NULL THEN NULL
          ELSE jsonb_build_object('id', vc.id, 'name', vc.name) END,
        'vehicle_label', mv.vehicle_label,
        'ledger_code', mv.ledger_code,
        'driver_code', mv.driver_code,
        'driver_name', mv.driver_name,
        'bordereau', mv.bordereau,
        'description', mv.description,
        'observation', mv.observation,
        'nature_de_charge', mv.nature_de_charge,
        'distance', mv.distance,
        'duree', mv.duree,
        'vehicle', CASE WHEN v.id IS NULL THEN NULL
          ELSE jsonb_build_object('id', v.id, 'code', v.code, 'registration_plate', v.registration_plate) END,
        'ledger_vehicle', CASE WHEN lv.id IS NULL THEN NULL
          ELSE jsonb_build_object('id', lv.id, 'plate_norm', lv.plate_norm, 'plate_raw', lv.plate_raw) END,
        'driver', CASE WHEN d.id IS NULL THEN NULL
          ELSE jsonb_build_object('id', d.id, 'name', d.name, 'code', d.code) END,
        'mission_expenses', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', e.id,
            'amount', e.amount,
            'source_column', e.source_column,
            'parsed_label', e.parsed_label,
            'needs_review', e.needs_review,
            'expense_category', CASE WHEN ec.id IS NULL THEN NULL
              ELSE jsonb_build_object('id', ec.id, 'code', ec.code, 'name_fr', ec.name_fr, 'name_en', ec.name_en) END
          ) ORDER BY e.id), '[]'::jsonb)
          FROM mission_expenses e
          LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
          WHERE e.mission_vehicle_id = mv.id
        )
      ) ORDER BY mv.id), '[]'::jsonb)
      FROM mission_vehicles mv
      LEFT JOIN vehicles v ON v.id = mv.vehicle_id
      LEFT JOIN ledger_vehicles lv ON lv.id = mv.ledger_vehicle_id
      LEFT JOIN drivers d ON d.id = mv.driver_id
      LEFT JOIN vehicle_categories vc ON vc.id = mv.category_id
      WHERE mv.mission_id = m.id
    )
  )
  FROM missions m
  -- The search disjunction MUST stay parenthesised: AND binds tighter than OR,
  -- so without these parentheses `p_search = ''` (the default) would OR the
  -- date/gendarmerie/vehicle/driver filters away and return every mission
  -- regardless of the window asked for.
  WHERE (
      COALESCE(p_search, '') = ''
      OR m.om          ILIKE '%' || p_search || '%'
      OR m.depart      ILIKE '%' || p_search || '%'
      OR m.destination ILIKE '%' || p_search || '%'
      OR m.a_travers   ILIKE '%' || p_search || '%'
    )
  AND (p_from IS NULL OR m.date_depart >= p_from)
  AND (p_to   IS NULL OR m.date_depart <= p_to)
  AND (p_gendarmerie IS NULL OR m.gendarmerie_required = p_gendarmerie)
  AND (COALESCE(p_vehicle, '') = '' OR EXISTS (
        SELECT 1
          FROM mission_vehicles mv
          LEFT JOIN vehicles v ON v.id = mv.vehicle_id
          LEFT JOIN ledger_vehicles lv ON lv.id = mv.ledger_vehicle_id
         WHERE mv.mission_id = m.id
           AND (COALESCE(v.code, '')               ILIKE '%' || p_vehicle || '%'
             OR COALESCE(v.registration_plate, '') ILIKE '%' || p_vehicle || '%'
             OR COALESCE(lv.plate_norm, '')        ILIKE '%' || p_vehicle || '%'
             OR COALESCE(lv.plate_raw, '')         ILIKE '%' || p_vehicle || '%'
             OR COALESCE(mv.vehicle_label, '')     ILIKE '%' || p_vehicle || '%'
             OR COALESCE(mv.ledger_code, '')       ILIKE '%' || p_vehicle || '%')
      ))
  AND (COALESCE(p_driver, '') = '' OR EXISTS (
        SELECT 1
          FROM mission_vehicles mv
          LEFT JOIN drivers d ON d.id = mv.driver_id
         WHERE mv.mission_id = m.id
           AND (COALESCE(mv.driver_name, '') ILIKE '%' || p_driver || '%'
             OR COALESCE(mv.driver_code, '') ILIKE '%' || p_driver || '%'
             OR COALESCE(d.name, '')         ILIKE '%' || p_driver || '%')
      ))
  ORDER BY m.date_depart DESC, m.om DESC;
$$;

REVOKE ALL ON FUNCTION public.missions_search(text, date, date, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.missions_search(text, date, date, boolean, text, text) TO authenticated;

COMMIT;
