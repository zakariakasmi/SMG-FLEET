# RTC Logistique — Missions & Travel-Expense Module

Design spec. Replaces the Excel ledger `RTC logistique (1).xlsx` (sheet `Etat`) with a browser module inside SMG-FLEET, at zero cost.

## 1. Goal

- One new top-level module **Missions**: fleet trips + per-trip travel expenses.
- Data source of truth for *history* = the Google Sheet `2025` tab.
- Excel `Etat` supplies the **schema** (27 columns), not the data.
- Everything runs on the existing Supabase project, existing auth/RLS, Vercel free tier.
- Out of scope: Excel's `PARAM` sheet, `KM Départ`, `VOYAGE CONFIRMER OUI/NON`.

## 2. Sources & scope

| | |
|---|---|
| Google Sheet | `docs.google.com/spreadsheets/d/10aKCa3bArY2Gs4gj4aKpNlM2WxITA1j5pRvGgE-ThC4` tab `2025` |
| Export | `AppData/Local/Temp/gsheet_live.csv` = fresh CSV download of the live tab (8,034 rows, 29 cols). The earlier `rtc_google.xlsx` working copy was **stale**; all figures below are re-baselined from the live CSV. |
| Schema ref | `Downloads/RTC logistique (1).xlsx` sheet `Etat` |
| **Scope filter** | `Date depart >= 2025-01-01` |
| Dropped | 2,908 rows (pre-2025 + undated junk: OM/date/MATRICULE null, 0.00 expense) |

### Authoritative in-scope numbers

| Metric | Value |
|---|---:|
| Rows (→ `mission_vehicles`) | **5,126** |
| Missions grouped by `(om, date_depart)` | **4,491** |
| Distinct `OM` values | 4,490 (OM `118587` reused twice — see §4) |
| Expense total | **1,963,111.58 MAD** |
| Distinct plates | 371 (183 ∈ fleet 440, 188 ∉) |
| Rows with plate / without | 5,048 / 78 |
| Expense line items (→ `mission_expenses`) | **9,445** |

### Expense columns (in scope)

| Source column | MAD | rows > 0 |
|---|---:|---:|
| frais de route | 711,225.00 | 3,378 |
| Auto route | 514,993.50 | 2,446 |
| Hotel | 501,600.00 | 1,267 |
| DÉPLACEMENT COMPLEMENTAIRE | 78,266.00 | 237 |
| Divers | 71,305.00 | 276 |
| Gardinnage | 41,745.00 | 1,384 |
| GASOIL | 24,897.08 | 49 |
| Procès | 19,080.00 | 93 |
| **Total** | **1,963,111.58** | |

`Divers` + `DÉPLACEMENT COMPLEMENTAIRE` = 149,571.00 across **513 rows** — the "catch-all" pair that gets parsed into per-item categories (§8).

## 3. Column → table mapping

Grouping rows by `(om, date_depart)` makes these **0-variant** within a group:
`Depart`, `Destination`, `A travers`, `Date arriver`, `Date reglement`.

Still varying per row: `Observation` (50 groups), `Nature de Charge` (3), `Distance` (6), `Durée` (5) → carried on `mission_vehicles` so nothing is lost.

| Excel column | Table.column |
|---|---|
| OM | `missions.om` |
| Date depart | `missions.date_depart` |
| Depart, Destination, A travers | `missions.*` |
| Date arriver, Date reglement | `missions.*` |
| MATRICULE | resolved → `mission_vehicles.vehicle_id` / `.ledger_vehicle_id` (§5) |
| Type Véhicule | `mission_vehicles.vehicle_type_raw` |
| Mlle, Nom | `mission_vehicles.driver_id` (§6) |
| CODE | `mission_vehicles.ledger_code` |
| N° bordoreau, Description | `mission_vehicles.*` |
| Observation, Nature de Charge, Distance, Durée | `mission_vehicles.*` |
| 8 expense columns | `mission_expenses` rows (§7) |
| Somme des OM | **not stored** — derived |
| ~~KM Départ~~, ~~VOYAGE CONFIRMER~~ | dropped |

## 4. Mission identity

`OM` is not globally unique: **OM 118587** appears twice with unrelated trips
(`2025-01-31 AWLOUZ→CASABLANCA` / `2025-07-19 BARRAGE TAROUDANT→BARRAGE TAMRI`, different vehicles).

→ `missions` gets a surrogate `id`; `UNIQUE (om, date_depart)`.

**`OM` may arrive as a float.** The Google Sheet CSV export delivers every cell as a string (`"139735"`), but the Excel `.xlsx` path yields numerics (`139735.0`). Normalize regardless of source: strip a trailing `.0`, store `varchar` → `139735`. The same applies to `N° bordoreau`, `Distance`, `Durée` (stray strings/numerics) — coerce or leave null, never store the raw `139735.0`.

**OM is also not a vehicle key** — 359 OMs span >1 distinct plate (e.g. OM 139735 → `54834B7`, `72226A13`, `81970A13`). Overrides and lookups must not key on `OM` alone.

## 5. Vehicle resolution

**Match on normalized plate only** — never on `CODE`. Among the **195** distinct plate-matched `(plate, CODE)` pairs, the ledger `CODE` equals `vehicles.code` in only **47** (2,874 rows), differs in **148** (856 rows), and 14 rows carry no `CODE` at all (fleet `CBN28` vs ledger `73310B7`, `TOY55` vs `42098A13`). `CODE` is a ledger chassis/asset number and is stored verbatim on `mission_vehicles.ledger_code`.

Normalization: fold accents (NFKD), uppercase, strip every non-alphanumeric → `81970-A-13` → `81970A13`.

> **Decision (plate scope):** normalize **only the 188 new `ledger_vehicles.plate_norm` values**. The existing 440 `vehicles.registration_plate` rows are left exactly as-is (their dotted form `81970-A-13` already normalizes 1:1, so bucketing still works). Matching is done in app code; no fleet rewrite.

| Bucket | rule | rows | MAD | link |
|---|---|---:|---:|---|
| A | plate ∈ 440 and ledger code = fleet code | 2,874 | 1,330,863.93 | `vehicle_id → vehicles` |
| B | plate ∈ 440, ledger code differs | 870 | 206,653.07 | `vehicle_id → vehicles` |
| C | plate ∉ 440 | 1,304 | 370,780.28 | `ledger_vehicle_id → ledger_vehicles` |
| — | no plate, no code | 78 | 54,814.30 | **neither** (§5.3) |
| | **total** | **5,126** | **1,963,111.58** | |

Buckets above are **pre-override**. A = 47 (plate, code) pairs, B = 148 pairs, C = 188 distinct plates.

Bucket C = **188 distinct plates**. The §5.3 override target `54134-B-7` is *in* the fleet (bucket A), so it does not add to C.

### 5.1 Plate uniqueness — verified clean, no deletion needed

`vehicles` is **440 rows / 440 distinct codes / 440 distinct plates** (verified live). There is *no* duplicate plate; an earlier finding of `82516-B-7 → CTR55 | CTR56` did not reproduce — in the current DB `CTR55 = 82516-B-7` (id 185) and `CTR56 = 82517-B-7` (id 186). Neither plate appears in the ledger. **No destructive prerequisite.**

> The old local dump `AppData/Local/Temp/fleet440.tsv` is **stale** (439 distinct plates). Re-dumped from the DB to `AppData/Local/Temp/fleet_live.tsv` (**440 rows / 440 distinct plates**, md5 `233df196618275ac47f44a878faea8f2`, verified). Use `fleet_live.tsv`.

Defensive rule regardless: if a normalized plate ever matches **>1** vehicle, set `needs_review` and link nothing — never guess.

### 5.2 No `plate_entries`

No alternate-plate/chassis mapping exists in the database (proposed earlier; never created). Bucket C plates are therefore genuinely unknown fleet units, not known units under a second plate.

### 5.3 The 78 rows with no plate (77 after override)

| | rows | treatment |
|---|---:|---|
| `Type Véhicule = TRANSPORT` | 65 | **legitimately plateless** — autocar/taxi hire. Verified consistent: all 65 `TRANSPORT` rows scope-wide have zero plates |
| OM 142358 | 1 | override → `54134-B-7` / `CTR44` → **in 440** → bucket **A** |
| remaining | 12 | **permanently unknown** — "sometimes even we don't know the plate" |

> **OM 134236 no longer needs an override:** the live sheet now carries its plate `45695-A-7` (code `45695-A-7`), which is not in the 440 → bucket **C** automatically. The former override (`…/CPB01`) is dropped. Only `142358` remains (`date_depart = 2025-01-10`, `MATRICULE` and `CODE` both `-`).

The 12: `142489, 143652, 144720, 146534, 146295, 150495, 86254, 86256, 160396` (single-line OMs) and three **partial gaps** where only one line of a multi-vehicle OM lacks a plate:

```
142336  82025A13, (none)
160353  82950A13, 54835B7, 87687A13, (none)
152186  82026A13, 79316B7, 87692A13, (none)
```

Unknown is a **first-class state**, not an error: `vehicle_type_raw` + `vehicle_label` carry what the sheet did say.

## 6. Drivers

In-scope driver data is complete — **0 rows lack both** code and name.

| | |
|---|---:|
| rows code+name / code-only / name-only / neither | 4,400 / 1 / 725 / 0 |
| distinct `Mlle` codes | 107 (case-folded; raw 108 — `F3638`/`f3638` differ only by case) |
| distinct `Nom` | 240 |
| names with no code | 135 |
| names reachable via a code | 105 |
| names appearing **both** coded and uncoded | 105 |
| codes with no name | 1 (`49533`) |

- **`drivers` = one row per normalized name (240) + 1 code-only row = 241.** Because 105 names appear with a code on some rows and without one on others, keying on `(code, name)` would split one person across two rows.
- Each of the 107 codes maps to exactly **one** name in scope (no code carries two names).
- Float IDs must be normalized: `42998.0` → `42998`.
- **`F9181` → `EL QUARS MUSTAPHA`** (confirmed).
- One **name carries two codes**: `ZALLAL KHALID` → `42205`, `45205`. Keep one in `code` (whichever is more frequent), the other in `alt_codes`.
- The code-only row (`49533`) has **no name** → `name`/`name_norm` must be nullable (see §10).
- Identity = `drivers(id, name, code)`; `code` nullable, `name_norm` unique. Import as-is; 32 near-duplicate name pairs (Appendix A) are flagged for user adjudication via an in-app merge, not auto-merged.

## 7. Expense model

**Line items**, one row per (mission vehicle × category × amount).

```
mission_expenses: 9,445 lines total
  8,617  from the 6 single-value columns (Auto route, Hotel, frais de route,
         Gardinnage, Procès, GASOIL) — 1 line each
   828  from the 513 catch-all rows (Divers + DÉPLACEMENT COMPLEMENTAIRE)
```

### Categories

`expense_categories` **is** the column set. Every charge type gets its own row so `Divers` can eventually be deleted. **28 categories**:

`auto_route`, `hotel`, `frais_de_route`, `gardinnage`, `proce`, `gasoil`, `divers` ← the source columns
`taxi`, `autocar`, `train`, `repas`, `achat`, `crevaison`, `lavage`, `evacuation_dechets`, `chargement_ciment`, `pesage`, `escorte_gendarmerie`, `reparation`, `bagage`, `pneus`, `extincteur`, `transport_personnes`, `main_oeuvre`, `frais_admin`, `postal`, `parking`, `douane` ← parsed out of the catch-all pair

`DÉPLACEMENT COMPLEMENTAIRE` becomes a pure carrier column with **0 remaining** — not a category.

Confirmed label mappings: `car` → `autocar`; `plaque d'immatricule` / `clé contact` / `plaque limite vitesse` → `achat`; `chariot aéroport` → `divers` (stays).

## 8. Catch-all parser

Two independent passes, combined.

### 8.1 Split the Observation into labelled amounts

```
(?P<bare>(?:=|:)\s*(?P<n1>[0-9][0-9 .\u202f\u00a0,]*?)\s*(?:D{1,2}H\b|D\.H\.?|(?=\s*(?:\)|\(|-|/|,|$)))
 |(?P<dh>(?<![0-9])(?P<n2>[0-9][0-9 .\u202f\u00a0,]*?)\s*(?:D{1,2}H\b|D\.H\.?)))
```

- Splits on `DH` boundaries; label = text since previous match.
- Accepts **bare numbers after `=` or `:`** — OM 142350 has `…REPAS = 230` with no `DH`, which was silently dropped before. The `=`/`:` guard keeps `PHC192` from parsing as `192`.
- Tolerates `15DDH`, `D.H.`, thin/no-break spaces.
- Numeric cells also tolerate `16/,20`.

### 8.2 Assign each item to the column it is booked in

Rules run in order (accent-folded, uppercased, apostrophes stripped):

`escorte_gendarmerie` (only if the OM's Observation mentions `GENDARM`, or `MOTO … ESCORT`) → `^FRAIS DE REPAS` → `^FRAIS D[' ]ESSENCE` → then:

`TRANSPORT PAR (CTM|TARIN|AUTO-?CAR|CAR)|AUTOCAR` → `autocar` · `TRANSPORT PAR (TRAIN|TGV)|TGV|TRAIN` → `train` · `TAXI` → `taxi` · `DEGAGEMENT|DEBARRASSAGE|EVACUATION|ORDURE|DECHET|GRAVAT|DEBLAI` → `evacuation_dechets` · `CHARGEMENT.*CIMENT` → `chargement_ciment` · `PESAGE|PEUSAGE` → `pesage` · `CREVAISON|CREVAISION|CHANGE PNEUS` → `crevaison` · `PROCES|PROCE\b|TACHYGRAPHE|HORS GABARIT|AMENDE` → `proce` · `EXTINCTEUR` → `extincteur` · `PNEU|EQUIL.?BRAGE` → `pneus` · `BAGAGE` · `DOUANE` · `LAVAGE|NETTOY` · `REPARATION|SOUDURE` · `ACHAT|FOURNITURE|IMPRIM|RECEPTION COLIS` · `ENVOI|POSTAL|COURRIER` · `PARKING|STATIONN` · `MAIN D.OEUVRE` · `HOTEL` · `REPAS|DEJEUNER|DINER` · `GARDI?ENN?AGE` · `AUTO\s*ROUTE|P[EÉ]AGE` · `ESSENCE|GAZOIL|CARBURANT` · `ROUTE|ITINERAIRE` · `TRANSPORT` · `IMMATRICUL|PLAQUE\s+LIMITE` · `CLE\s+CONTACT` · `CHARIOT\s+AEROPORT` → `divers` · `LEGALISATION|COURSES|VISITE` → `frais_admin`

Fallback: `Description` disambiguates (OM 141181 `CHARGEMENT 20T` + desc `CIMENT` → `chargement_ciment`). `Description` never contains an amount (verified 0/5,126).

Each item is then backtracked into the column it is **booked in**, with per-category candidate columns. If the primary column has 0 for that record, fall back to `Divers`/`DÉPLACEMENT COMPLEMENTAIRE`.

### 8.3 Balance — no scaling

**Proportional scaling is forbidden.** After assigning lines:

- residual > 0 → append an explicit `divers` line `solde non expliqué`
- residual < 0 → absorb into the last line
- every line rounded to 2dp first; the last line absorbs the cent

A guard rejects any single line exceeding its column total (this caught the `4,500` → `4.5` thousands-comma bug).

### 8.4 Result

| | rows | MAD |
|---|---:|---:|
| exact — parsed total = booked | **504** | **146,203.00** |
| review — unreadable / no home column | **9** | **3,368.00** |
| **total** | 513 | 149,571.00 |

- 513/513 records balance **to the cent**; 0 unexplained solde lines.
- 97.7% of the catch-all money splits automatically.
- Review breakdown: 4 empty `Observation` (860) + 5 item-doesn't-fit (2,508) — `DEPANNAGE REMORQUAGE`, `TRANSPORT PAR CAR` with no home column, etc.
- No unnamed labels remain (0.00 MAD).

> **Decision (Divers split — Option B):** every catch-all item that parses cleanly is auto-assigned to its own category; only the **9** rows that cannot be placed stay in `divers` with `needs_review = true`, to be re-categorised manually. Nothing is auto-scattered into leftovers, and no proportional scaling is ever used. This is what the 497/9 result above already produces.

**Known gaps:** **5** records where the item has no home column (`no-fit`) and **4** rows whose `Observation` is empty (`unparseable`) = the 9 in Appendix C. These carry `needs_review = true`.

## 9. Gendarmerie escorts

`Observation ~ /GENDARM/i` → **13 OMs**, 12 with charges (`160490` = 0). **78,141 MAD**:

| component | MAD |
|---|---:|
| escort fees | 59,500 |
| moto essence | 15,328 |
| repas | 3,313 |
| **total** | **78,141** |

The 13 OMs: `81693, 140351, 145683, 147314, 147321, 150314, 150325, 150475, 152186, 154210, 156926, 160353, 160490`.

**Excluded (per decisions):** hotel waiting 1,300 · procès 600 · crevaison 160 · lampe/plaque 75 · OM 160399 envoi papiers 175.
**Included:** OM 150325 `ESCORT POUR GENDARME` 2,700 · `FRAIS DE REPAS` · `FRAIS D'ESSENCE`.
OM 160399 drops out entirely (no `GENDARM` match). OM 138100 is **no longer** a gendarmerie match in the live sheet, so its former `Divers` 534 fallback is dropped (and the `moto repair` 400 is no longer attributable).

Booked total on those 13 OMs = 100,116.50 (mission-level, everything included).

Two export levels:
- **charge-level** 78,141 — gendarmerie-attributable lines (`escorte_gendarmerie`, `gasoil`, `repas`) on any vehicle, **plus the escort vehicle's entire cost** (e.g. its `frais de route`, which is the escort fee)
- **mission-level** 100,116.50 (whole OM)

## 10. Schema DDL

All new except two nullable drops. Deliberate deviations kept from the existing DB: integer serial PKs, `varchar`, `timestamp without time zone`.

```sql
-- prerequisite (§5.1): brand/fuel_type are NOT NULL today, ledger has no such data
ALTER TABLE vehicles ALTER COLUMN brand DROP NOT NULL;
ALTER TABLE vehicles ALTER COLUMN fuel_type DROP NOT NULL;
-- regenerating fleet440.tsv from the DB is also a prerequisite (stale dump)

CREATE TABLE ledger_vehicles (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plate_norm    text        NOT NULL UNIQUE,     -- 188 bucket-C plates (the §5.3 override target is in the fleet, not here)
  plate_raw     text,
  vehicle_id    integer     REFERENCES vehicles(id),   -- promotion to fleet
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE drivers (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          varchar UNIQUE,                 -- Mlle, nullable; alt codes go in alt_codes
  alt_codes     varchar[],                      -- ZALLAL KHALID: 42205 + 45205
  name          varchar,                        -- nullable: code 49533 has no name
  name_norm     varchar UNIQUE,                 -- nullable: one row per normalized name
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

CREATE TABLE expense_categories (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          varchar UNIQUE NOT NULL,        -- auto_route, taxi, ...
  name_fr       varchar NOT NULL,
  name_en       varchar NOT NULL,
  source_column varchar,                        -- null for parsed-only categories
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
  vehicle_type_raw  varchar,          -- sheet's "Type Véhicule"
  vehicle_label     varchar,          -- display fallback for unknowns
  ledger_code       varchar,          -- sheet's CODE, verbatim
  driver_id         integer   REFERENCES drivers(id),
  driver_code       varchar,          -- Mlle as written, for audit
  driver_name       varchar,          -- Nom as written, for audit
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
  )  -- <= 1, not = 1: TRANSPORT and unknowable rows carry neither
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
  source_column       varchar,      -- which Excel column booked it (§12 balance assertion)
  parsed_label        varchar,      -- original Observation fragment
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
  line_no      integer NOT NULL DEFAULT 1,   -- 1-based row index within the (om, date_depart) group
  plate_raw    varchar NOT NULL,
  code_raw     varchar,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (om, date_depart, line_no)   -- OM alone is NOT unique (§4), and a (om, date_depart)
                                      -- group may hold several vehicles (359 OMs span >1 plate),
                                      -- so an override must target one specific line
);
```

Estimated load: 4,491 missions · 5,126 mission_vehicles · 9,445 mission_expenses · 28 expense_categories · **241 drivers** (240 names + 1 code-only) · **188 ledger_vehicles**.

**Post-override load.** Applying the single override in §5.3 (OM 142358 → bucket A) ships A = 2,875 · B = 870 (A+B = 3,745) · C = 1,304 rows / 188 plates · neither = 77. (Pre-override: A = 2,874 · B = 870 · C = 1,304 · neither = 78.)

## 11. App integration

Stack: Vite + React 18 + Tailwind + Apple HIG (`src/components/ui/`), react-i18next (en+fr), papaparse/xlsx/jspdf-autotable, Supabase Postgres + Auth + RLS, Vercel free. Not Next.js.

| File | Change |
|---|---|
| `src/App.jsx` | routes `/missions`, `/missions/:id`; `/vehicles/:code` unchanged |
| `src/services/api.js` | sole data layer — add `missionsApi`, `missionExpensesApi`, `expenseCategoriesApi`, `ledgerVehiclesApi`, `driversApi` |
| `src/constants/permissions.js` | add `{ key: 'missions', labelKey: 'settings.permMissions' }` to `PERMISSION_SCOPES` (11 → 12), plus a `settings.permMissions` label |
| `src/components/layout/Sidebar.jsx` | add `{ icon, label: t('sidebar.missions'), path: '/missions', scope: 'missions' }` to `navItems` (4 → 5) |
| `src/pages/import/Import.jsx` | `STEP_ORDER = ['upload','mapping','review','result']` — ledger import becomes a **second mode** that skips `mapping` (schema is fixed) |
| `src/pages/export/Export.jsx` | add 5th export type **"État escorte gendarmerie"** (charge-level + mission-level toggle) |
| `src/i18n/locales/en.json`, `fr.json` | every new string in **both** |
| `src/constants/exportColumns.js` | keep in sync with `Export.jsx` |

### Import pipeline (one-shot, re-runnable)

1. Upload sheet `2025` → filter `Date depart >= 2025-01-01` (5,126).
2. Normalize plates → resolve buckets A/B/C; apply `import_vehicle_overrides` (OM 142358 only).
3. Group by `(om, date_depart)` → upsert `missions`.
4. Upsert `ledger_vehicles`, `drivers`.
5. Row → `mission_vehicles` with bucket link + `vehicle_type_raw`/`vehicle_label` fallback.
6. 6 fixed columns → 8,617 `mission_expenses`.
7. 513 catch-all rows → parse (§8) → 828 `mission_expenses`, `needs_review` on the 9.
8. Set `missions.gendarmerie_required` for the 13 OMs.
9. Write `import_logs` (existing table) with counts + `error_details` jsonb.

**Idempotency:** upsert `missions` / `mission_vehicles` on their natural keys; **delete `mission_expenses` for each touched `mission_vehicle_id` before re-inserting** its lines. There is deliberately **no** unique constraint on `(mission_vehicle_id, expense_category_id, amount)` — the same category+amount legitimately repeats within one row (OM 142350 has `lavage 50` twice).

### UI

- `/missions` list: filters (date range, departure, destination, vehicle, driver, gendarmerie, needs-review), search, KPIs, export.
- `/missions/:id` detail: header (OM, dates, route), vehicle table with driver + resolved vehicle, expense lines by category, `Observation`.
- **Review queue**: `mission_expenses where needs_review` (9 rows) + vehicle-unknown queue (12 rows).
- Vehicle chips show `vehicles.code`, `ledger_vehicles.plate_norm`, or `vehicle_label` for unknowns.

## 12. Verification

No test framework, no typecheck; `npm run lint` is broken — **never run it**.

- `npm run build` after each task (`dist/` regenerates; committed artifact).
- Data assertions after import:
  - `count(missions) = 4491`, `count(mission_vehicles) = 5126`
  - `count(mission_expenses) = 9445`
  - `sum(amount) = 1963111.58`
  - `sum(amount) where needs_review = 3368.00`
  - bucket A = 2,875 · B = 870 · C = 1,304 · neither = 77 (post-override; A+B = 3,745)
  - `ledger_vehicles` = 188 · `drivers` = 241
  - `missions where gendarmerie_required = 13`
  - every (mission_vehicle, booked column) group balances to the cent
- Manual: sidebar 5 nav items (dashboard, vehicles, import, export, missions), EN/FR parity, dark mode, mobile, deep link `/vehicles/:code`, import wizard mode switch, gendarmerie export.

## 13. Open items

Decided this round: plate normalization scope = **188 new ledger plates only** (§5); Divers split = **Option B** (§8.4).

Still open:

1. **Driver name merges (Appendix A)** — candidate pairs; needs human adjudication, exposed as an in-app merge rather than auto-applied. **Done (Plan 3 Task 9):** `/missions/drivers` shows the candidate groups with each driver's occurrence count and lets an operator pick the survivor; the losers' lines are re-pointed and the duplicates removed. Never auto-applied. (Writes need the `import` scope, since RLS gates all ledger writes there.)
2. **9 expense lines needing review** and **12 unknown vehicles** — surfaced in queues, resolved manually over time.
3. **Security (flagged, out of scope):** 6 `SECURITY DEFINER` functions callable by `anon`; `update_updated_at_column` has a mutable `search_path`.
4. `missions` is a **read-only** module (view + export only, no in-app create/edit/delete). Access is **gated by the `missions` permission scope** — *not* added to `READ_ONLY_SCOPES` (which in this codebase means "every authenticated user") — so the sidebar/route and the scope-gated RLS agree. Change if editing is wanted later.

---

## Appendix A — Driver name merge candidates (32)

High-confidence:

| | occurrences |
|---|---|
| `EL QUARS REGRAGUI` ~ `REGRAGUI EL QUARS` | 115 / 3 |
| `ATIQ ABDEKHALEK` ~ `ATIQ ABDELKHALEK` | 1 / 49 |
| `BELMOUNATI LHABIB` ~ `BELMOUNATI LHBIB` | 4 / 38 |
| `AIT BEN HAMED HASSAN` ~ `AIT BEN HAMID HASSAN` | 32 / 1 |
| `LAHCEN OUHADDOU` ~ `LAHCEN OUHADOU` | 7 / 6 |
| `ASKOUK LHOCINE` ~ `ASKOUK LHOUCINE` | 8 / 2 |
| `ATTAR RACHID` ~ `EL ATTAR RACHID` | 1 / 7 |
| `AZDDINE SABER` ~ `AZDINE SABER` | 5 / 2 |
| `HAIDAR NOURDDINE` ~ `HAIDAR NOUREDDINE` | 6 / 1 |
| `BOULHRI MOHAMED` ~ `MOHAMED BOULHRI` | 5 / 1 |
| `EL MADANI SAMIR` ~ `SAMIR EL MADANI` | 2 / 1 |
| `KASEM TOTO` ~ `TOTO KASEM` | 1 / 2 |
| `CHAKIR SAID` ~ `SAID CHAKIR` | 1 / 1 |
| `KASMI SALAH` ~ `SALAH KASMI` | 1 / 1 |
| `AZOUZ KHALID` ~ `KHALID AZOUZ` | 1 / 1 |

Lower confidence (verify before merging): `HAMADI/HMADI MUSTAPHA` 2/2 · `AMGHID/AUGHID MUSTAPHA` 2/1 · `RACHID/RACHIDI/RACHDI MOHAMED` 3/2/1 · `NEGGAY/NEGUAY SGHIR` 2/1 · `EL HYA/EL NYA YOUSSEF` 2/1 · `BAKRAOUI/BEKRAOUI RACHID` 1/1 · `CHAIT/ECHAIT/ECHAYET MOHAMED` 1/1/1 · `EL BAYHAKI/EL BEYHAKI MOHAMED` 1/1 · `GZOULI/LAGZOULI ABDERRAZEK` 1/1 · `BOUHMI MOHAMED/BOULHRI MOHAMED` 1/5 · `KAKTA/LAKTAM HOUMAD` 1/2 · `REGIGI/REGUIG MOHAMED` 1/1.

Also: `ZALLAL KHALID` carries two codes (`42205`, `45205`).

## Appendix B — The 13 plateless non-TRANSPORT rows (12 open, 1 resolved)

Of the 78 plateless rows: 65 are `Type Véhicule = TRANSPORT` (§5.3), the other 13 are these.

Single-line OMs with no plate: `142489` (recup camion 8x4) · `143652` (livraison voiture) · `144720` (Toyota Lixus) · `146534` (divers SCE) · `146295` (remise camion 8x4) · `150495` (voiture pour Mr Sébastien) · `86254` (amener camion à Casa) · `86256` (suivi entretien camion) · `160396` (retour par CarBus).

Partial gaps — one plateless line inside an OM whose other lines have plates: `142336`, `160353`, `152186`.

Resolved: `142358` → `54134-B-7`/`CTR44` (fleet). OM `134236` is **no longer plateless** — the live sheet now carries its plate `45695-A-7` (bucket C), so no override is needed.

## Appendix C — The 9 expense lines needing review

| OM | column | MAD | reason |
|---|---|---:|---|
| 143712 | Divers | 220 | empty Observation |
| 141059 | Divers | 20 | empty Observation |
| 148255 | DÉPLACEMENT COMPLEMENTAIRE | 600 | empty Observation |
| 155445 | Divers | 20 | empty Observation |
| 147726 | DÉPLACEMENT COMPLEMENTAIRE | 60 | `TRANSPORT PAR CAR TANGER` — no home column |
| 150489 | Divers | 691 | `REPAS = 631` + plaque, exceeds column |
| 153630 | Divers | 7 | `PROCES = 150` (tachygraphe) exceeds column |
| 153630 | DÉPLACEMENT COMPLEMENTAIRE | 950 | same OM, no home column |
| 154762 | Divers | 800 | `DÉPANNAGE REMORQUAGE` — no home column |
| | | **3,368.00** | |
