-- =====================================================
-- RTC Logistique — RLS
-- =====================================================
ALTER TABLE ledger_vehicles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_vehicles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_expenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_vehicle_overrides ENABLE ROW LEVEL SECURITY;

-- ---- missions (read: missions scope) ----
CREATE POLICY missions_read ON missions
  FOR SELECT TO authenticated USING ((SELECT public.user_has_permission('missions')));

-- ---- mission_vehicles ----
CREATE POLICY mv_read ON mission_vehicles
  FOR SELECT TO authenticated USING ((SELECT public.user_has_permission('missions')));

-- ---- mission_expenses ----
CREATE POLICY me_read ON mission_expenses
  FOR SELECT TO authenticated USING ((SELECT public.user_has_permission('missions')));

-- ---- reference tables (read with missions scope) ----
CREATE POLICY expense_categories_read ON expense_categories
  FOR SELECT TO authenticated USING ((SELECT public.user_has_permission('missions')));
CREATE POLICY drivers_read ON drivers
  FOR SELECT TO authenticated USING ((SELECT public.user_has_permission('missions')));
CREATE POLICY ledger_vehicles_read ON ledger_vehicles
  FOR SELECT TO authenticated USING ((SELECT public.user_has_permission('missions')));

-- ---- import writes (import scope) ----
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ledger_vehicles','drivers','expense_categories',
                           'missions','mission_vehicles','mission_expenses',
                           'import_vehicle_overrides'] LOOP
    EXECUTE format(
      'CREATE POLICY %1$s_write ON %1$I FOR ALL TO authenticated '
      'USING ((SELECT public.user_has_permission(''import''))) '
      'WITH CHECK ((SELECT public.user_has_permission(''import'')))', t);
  END LOOP;
END $$;
