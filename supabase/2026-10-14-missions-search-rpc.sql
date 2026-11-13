-- =====================================================
-- RTC Logistique — server-side missions search
-- =====================================================
-- The missions list used to filter search/date/gendarmerie in PostgREST and
-- everything else client-side. Vehicle and driver, however, live on
-- mission_vehicles and join on to vehicles / ledger_vehicles, and this PostgREST
-- version cannot OR a parent row across nested embeds (PGRST100). Filtering them
-- server-side therefore needs a SQL function.
--
-- `missions_search` returns the exact JSON shape the client already consumes
-- (missions → mission_vehicles → mission_expenses → expense_category), filtered
-- and ordered, so it is a drop-in replacement for the embedded select. It is
-- `security invoker`, so the caller's RLS (missions read scope) still applies.

create or replace function public.missions_search(
  p_search      text    default '',
  p_from        date    default null,
  p_to          date    default null,
  p_gendarmerie boolean default null,
  p_vehicle     text    default '',
  p_driver      text    default ''
) returns setof jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
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
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', mv.id,
        'vehicle_id', mv.vehicle_id,
        'ledger_vehicle_id', mv.ledger_vehicle_id,
        'vehicle_type_raw', mv.vehicle_type_raw,
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
        'vehicle', case when v.id is null then null
          else jsonb_build_object('id', v.id, 'code', v.code, 'registration_plate', v.registration_plate) end,
        'ledger_vehicle', case when lv.id is null then null
          else jsonb_build_object('id', lv.id, 'plate_norm', lv.plate_norm, 'plate_raw', lv.plate_raw) end,
        'driver', case when d.id is null then null
          else jsonb_build_object('id', d.id, 'name', d.name, 'code', d.code) end,
        'mission_expenses', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', e.id,
            'amount', e.amount,
            'source_column', e.source_column,
            'parsed_label', e.parsed_label,
            'needs_review', e.needs_review,
            'expense_category', case when ec.id is null then null
              else jsonb_build_object('id', ec.id, 'code', ec.code, 'name_fr', ec.name_fr, 'name_en', ec.name_en) end
          ) order by e.id), '[]'::jsonb)
          from mission_expenses e
          left join expense_categories ec on ec.id = e.expense_category_id
          where e.mission_vehicle_id = mv.id
        )
      ) order by mv.id), '[]'::jsonb)
      from mission_vehicles mv
      left join vehicles v on v.id = mv.vehicle_id
      left join ledger_vehicles lv on lv.id = mv.ledger_vehicle_id
      left join drivers d on d.id = mv.driver_id
      where mv.mission_id = m.id
    )
  )
  from missions m
  -- The search disjunction MUST stay parenthesised: AND binds tighter than OR in
  -- SQL, so without these parentheses `p_search = ''` (the default) would OR the
  -- date/gendarmerie/vehicle/driver filters away and the RPC would return every
  -- mission regardless of the window asked for.
  where (
      coalesce(p_search, '') = ''
      or m.om          ilike '%' || p_search || '%'
      or m.depart      ilike '%' || p_search || '%'
      or m.destination ilike '%' || p_search || '%'
      or m.a_travers   ilike '%' || p_search || '%'
    )
  and (p_from is null or m.date_depart >= p_from)
  and (p_to   is null or m.date_depart <= p_to)
  and (p_gendarmerie is null or m.gendarmerie_required = p_gendarmerie)
  and (coalesce(p_vehicle, '') = '' or exists (
        select 1
          from mission_vehicles mv
          left join vehicles v on v.id = mv.vehicle_id
          left join ledger_vehicles lv on lv.id = mv.ledger_vehicle_id
         where mv.mission_id = m.id
           and (coalesce(v.code, '')               ilike '%' || p_vehicle || '%'
             or coalesce(v.registration_plate, '') ilike '%' || p_vehicle || '%'
             or coalesce(lv.plate_norm, '')        ilike '%' || p_vehicle || '%'
             or coalesce(lv.plate_raw, '')         ilike '%' || p_vehicle || '%'
             or coalesce(mv.vehicle_label, '')     ilike '%' || p_vehicle || '%'
             or coalesce(mv.ledger_code, '')       ilike '%' || p_vehicle || '%')
      ))
  and (coalesce(p_driver, '') = '' or exists (
        select 1
          from mission_vehicles mv
          left join drivers d on d.id = mv.driver_id
         where mv.mission_id = m.id
           and (coalesce(mv.driver_name, '') ilike '%' || p_driver || '%'
             or coalesce(mv.driver_code, '') ilike '%' || p_driver || '%'
             or coalesce(d.name, '')         ilike '%' || p_driver || '%')
      ))
  order by m.date_depart desc, m.om desc;
$$;

grant execute on function public.missions_search(text, date, date, boolean, text, text) to authenticated;
revoke execute on function public.missions_search(text, date, date, boolean, text, text) from public;
