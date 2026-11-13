# 2026-10-09 — RTC Logistique · Plan 1: DB foundation

Source of truth: `docs/superpowers/specs/2026-10-09-rtc-logistique-design.md` §5–§10. This plan creates the schema, seeds `expense_categories`, adds RLS, and wires the `missions` permission scope. No UI, no import logic. Execute plans 2 and 3 after this.

## Global constants

Nothing new. Tables follow the existing DB conventions (§10): integer serial PKs, `varchar`, `timestamp without time zone`, `timestamptz` for new audit columns. Migrations are plain SQL files in `supabase/`, applied manually in the Supabase SQL editor; comment-banner style as in `supabase/2026-09-29-charge-years.sql`.

## Files

### New
- `supabase/2026-10-09-rtc-logistique-schema.sql`
- `supabase/2026-10-09-rtc-logistique-seed.sql`
- `supabase/2026-10-09-rtc-logistique-rls.sql`

### Modified
- `src/constants/permissions.js` (11 → 12 scopes, `READ_ONLY_SCOPES`)
- `src/i18n/locales/en.json`, `fr.json` (`settings.permMissions` only)

## Tasks

### Task 1 — Schema DDL

Create `supabase/2026-10-09-rtc-logistique-schema.sql` with the exact DDL from spec §10 (verbatim below). Apply in the SQL editor.

```sql
-- =====================================================
-- RTC Logistique — schema (§10)
-- =====================================================
-- prerequisite: vehicles.brand / vehicles.fuel_type are NOT NULL today
ALTER TABLE vehicles ALTER COLUMN brand DROP NOT NULL;
ALTER TABLE vehicles ALTER COLUMN fuel_type DROP NOT NULL;

CREATE TABLE ledger_vehicles (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plate_norm    text        NOT NULL UNIQUE,
  plate_raw     text,
  vehicle_id    integer     REFERENCES vehicles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE drivers (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          varchar UNIQUE,
  alt_codes     varchar[],
  name          varchar,
  name_norm     varchar UNIQUE,
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

CREATE TABLE expense_categories (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          varchar UNIQUE NOT NULL,
  name_fr       varchar NOT NULL,
  name_en       varchar NOT NULL,
  source_column varchar,
  is_divers     boolean NOT NULL DEFAULT false,
  sort_order    integer NOT NULL DEFAULT 0
);

CREATE TABLE missions (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  om                   varchar NOT NULL,
  date_depart          date    NOT NULL,
  depart               varchar,
  destination          varchar,
  a_travers            varchar,
  date_arriver         date,
  date_reglement       date,
  gendarmerie_required boolean NOT NULL DEFAULT false,
  source               varchar NOT NULL DEFAULT 'google_2025',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (om, date_depart)
);
CREATE INDEX missions_om_idx ON missions (om);
CREATE INDEX missions_date_depart_idx ON missions (date_depart);
CREATE INDEX missions_gendarmerie_idx ON missions (id) WHERE gendarmerie_required;

CREATE TABLE mission_vehicles (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mission_id        bigint    NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  vehicle_id        integer   REFERENCES vehicles(id) ON DELETE RESTRICT,
  ledger_vehicle_id bigint    REFERENCES ledger_vehicles(id) ON DELETE RESTRICT,
  vehicle_type_raw  varchar,
  vehicle_label     varchar,
  ledger_code       varchar,
  driver_id         integer   REFERENCES drivers(id),
  driver_code       varchar,
  driver_name       varchar,
  bordereau         varchar,
  description       text,
  observation       text,
  nature_de_charge  varchar,
  distance          numeric,
  duree             numeric,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_vehicles_one_vehicle CHECK (
      (CASE WHEN vehicle_id        IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN ledger_vehicle_id IS NOT NULL THEN 1 ELSE 0 END) <= 1
  )
);
CREATE INDEX mv_mission_idx   ON mission_vehicles (mission_id);
CREATE INDEX mv_vehicle_idx   ON mission_vehicles (vehicle_id)   WHERE vehicle_id IS NOT NULL;
CREATE INDEX mv_ledger_idx    ON mission_vehicles (ledger_vehicle_id) WHERE ledger_vehicle_id IS NOT NULL;
CREATE INDEX mv_driver_idx    ON mission_vehicles (driver_id);

CREATE TABLE mission_expenses (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mission_vehicle_id  bigint    NOT NULL REFERENCES mission_vehicles(id) ON DELETE CASCADE,
  expense_category_id integer   NOT NULL REFERENCES expense_categories(id),
  amount              numeric   NOT NULL CHECK (amount > 0),
  source_column       varchar,
  parsed_label        varchar,
  needs_review        boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX me_mv_idx     ON mission_expenses (mission_vehicle_id);
CREATE INDEX me_category_idx ON mission_expenses (expense_category_id);
CREATE INDEX me_review_idx ON mission_expenses (id) WHERE needs_review;

CREATE TABLE import_vehicle_overrides (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  om           varchar NOT NULL,
  date_depart  date    NOT NULL,
  line_no      integer NOT NULL DEFAULT 1,
  plate_raw    varchar NOT NULL,
  code_raw     varchar,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (om, date_depart, line_no)
);
```

Verify with the SQL tool: the 6 tables exist and `information_schema.columns` shows the columns above.

### Task 2 — Seed `expense_categories` (28)

Create `supabase/2026-10-09-rtc-logistique-seed.sql`. Idempotent insert keyed on `code`.

```sql
-- =====================================================
-- RTC Logistique — expense_categories seed (28) (§7)
-- =====================================================
INSERT INTO expense_categories (code, name_fr, name_en, source_column, is_divers, sort_order) VALUES
  ('auto_route',           'Auto route',              'Toll (Auto route)',        'Auto route',               false,  10),
  ('hotel',                'Hôtel',                   'Hotel',                    'Hotel',                    false,  20),
  ('frais_de_route',       'Frais de route',          'Travel expenses',         'frais de route',           false,  30),
  ('gardinnage',           'Gardiennage',             'Guarding',                'Gardinnage',               false,  40),
  ('proce',                'Procès',                  'Legal / court fees',      'Procès',                   false,  50),
  ('gasoil',               'Gasoil',                  'Diesel',                  'GASOIL',                   false,  60),
  ('divers',               'Divers',                  'Miscellaneous',           'Divers',                   true,   70),
  ('taxi',                 'Taxi',                    'Taxi',                    NULL,                       false, 100),
  ('autocar',              'Autocar',                 'Coach / bus',             NULL,                       false, 110),
  ('train',                'Train',                   'Train',                   NULL,                       false, 120),
  ('repas',                'Repas',                   'Meals',                   NULL,                       false, 130),
  ('achat',                'Achat',                   'Purchase',                NULL,                       false, 140),
  ('crevaison',            'Crevaison',               'Tyre puncture',           NULL,                       false, 150),
  ('lavage',               'Lavage',                  'Washing',                 NULL,                       false, 160),
  ('evacuation_dechets',   'Évacuation déchets',      'Waste removal',           NULL,                       false, 170),
  ('chargement_ciment',    'Chargement ciment',       'Cement loading',          NULL,                       false, 180),
  ('pesage',               'Pesage',                  'Weighing',                NULL,                       false, 190),
  ('escorte_gendarmerie',  'Escorte gendarmerie',     'Gendarmerie escort',      NULL,                       false, 200),
  ('reparation',           'Réparation',              'Repair',                  NULL,                       false, 210),
  ('bagage',               'Bagage',                  'Luggage',                 NULL,                       false, 220),
  ('pneus',                'Pneus',                   'Tyres',                   NULL,                       false, 230),
  ('extincteur',           'Extincteur',              'Fire extinguisher',       NULL,                       false, 240),
  ('transport_personnes',  'Transport personnes',     'Passenger transport',     NULL,                       false, 250),
  ('main_oeuvre',          'Main d''œuvre',           'Labour',                  NULL,                       false, 260),
  ('frais_admin',          'Frais administratifs',    'Administrative fees',     NULL,                       false, 270),
  ('postal',               'Postal / envoi',          'Postal / courier',        NULL,                       false, 280),
  ('parking',              'Parking',                 'Parking',                 NULL,                       false, 290),
  ('douane',               'Douane',                  'Customs',                 NULL,                       false, 300)
ON CONFLICT (code) DO NOTHING;
```

Verify: `select count(*) from expense_categories;` → `28`; `select count(*) from expense_categories where source_column is not null;` → `7`; `is_divers` true only on `divers`.

### Task 3 — RLS

Create `supabase/2026-10-09-rtc-logistique-rls.sql`. Read = any authenticated user with the `missions` scope; writes = the `import` scope (import wizard is the only writer). The reference tables (`expense_categories`) are readable when the `missions` scope is present too.

```sql
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
```

Note: the reference tables get **both** a `_read` and a `_write` policy; PostgreSQL ORs policies of the same command, so SELECT is allowed by either policy (correct). Verify after running `supabase_get_advisors` security → no new `rls_disabled` or `rls_enabled_no_policy` warnings for the 7 new tables.

### Task 4 — Permission scope + label

`src/constants/permissions.js` (17 lines): add the 12th scope. **Do not** add `missions` to `READ_ONLY_SCOPES` — that list means "every authenticated user", which would bypass the `missions` permission and disagree with the scope-gated RLS below.

```js
// in PERMISSION_SCOPES, after the existing entries:
{ key: 'missions', labelKey: 'settings.permMissions' },

// READ_ONLY_SCOPES stays as-is:
export const READ_ONLY_SCOPES = ['vehicles', 'charges', 'export']
```

Also add the new key to `src/types/models.ts`'s parallel `PERMISSION_SCOPES` union (it declares `PermissionScope`).

Also add `'missions'` to `PERMISSION_GROUPS` in **both** `src/pages/settings/Settings.jsx` and `src/pages/settings/AddUser.jsx` (the grid only renders keys listed there — appending to the `settings.permGroupData` group).

Add the label to **both** locales (only this key in plan 1; the rest of the Missions i18n lands in plan 3):

```json
// en.json → settings
"permMissions": "Missions (RTC logistique)",
// fr.json → settings
"permMissions": "Missions (RTC logistique)"
```

After this task, open Settings → the permissions grid shows 12 scopes and no crash.

## Verification

- SQL: schema tables + columns present (Task 1); `expense_categories = 28`, 7 with `source_column` (Task 2).
- Advisors: `supabase_get_advisors('security')` shows no missing-RLS on the 7 new tables.
- RLS: an authenticated user **without** the `missions` scope reads 0 rows from `missions` (via SQL `set role authenticated` with a JWT-less request is not possible through anon REST — verify by policy definition, not REST).
- `npm run build` after Task 4 succeeds (`dist/` regenerates; committed artifact).
- Settings page renders 12 permission scopes.

## Handoff

Plan 2 (import pipeline) depends on: the 7 tables, the 28 categories, `import`-scoped write policies, and the `missions` scope. Stop after Task 4 and start Plan 2.
