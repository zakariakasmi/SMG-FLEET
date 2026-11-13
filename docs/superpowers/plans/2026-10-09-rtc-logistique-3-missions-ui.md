# 2026-10-09 — RTC Logistique · Plan 3: Missions UI + gendarmerie export + i18n

Source of truth: `docs/superpowers/specs/2026-10-09-rtc-logistique-design.md` §9, §11 UI, §13.4. Depends on Plan 1 (scope, tables) and Plan 2 (data + `missionsApi`). This plan ships the read-only `missions` module, the review queues, and the gendarmerie export type.

## Status: EXECUTED (2026-10-12)

Code complete; `npm run build` is green. The **data-dependent** manual checks below (row counts, the 78,141 / 100,116.50 gendarmerie totals, the 9 review rows, the 12 unknown vehicles) can only pass **after the Plan 2 import is run in the browser**: at the time of writing `missions`/`mission_vehicles`/`mission_expenses`/`drivers`/`ledger_vehicles` are all **0 rows**. Every figure in this UI is computed from live data — nothing is hardcoded — so those numbers are expectations, not assertions.

## Global constants

Reuse the Apple-HIG design tokens and `src/components/ui/` primitives (Card, Table, Input, Select, Button, EmptyState, Skeleton). No new deps. `missions` is **read-only** (spec §13.4): view + export only, no create/edit/delete, so no new i18n verbs beyond labels.

## Files

### New
- `src/pages/missions/MissionsList.jsx`
- `src/pages/missions/MissionDetail.jsx`
- `src/pages/missions/DriverMerge.jsx` — Task 9 (in-app driver merge)
- `src/components/missions/MissionFilters.jsx`
- `src/components/missions/GendarmerieExport.jsx` — sketched as `GendarmerieExportButton.jsx`; it is a self-contained panel (level toggle + preview + generate), not just a button
- `src/constants/missionExportColumns.js`
- `src/constants/driverMergeCandidates.js` — Appendix-A candidate groups (Task 9)
- `src/utils/missions.js` — shared chip / amount / driver / review helpers
- `src/utils/mergeDrivers.js` — pure, client-injected merge sequence (Task 9)

### Modified
- `src/App.jsx` — routes `/missions`, `/missions/drivers` (before `:id`), `/missions/:id`
- `src/components/layout/Sidebar.jsx` — 4 → 5 nav items (`Route` icon)
- `src/pages/export/Export.jsx` — 5th export type "État escorte gendarmerie"
- `src/pages/import/LedgerImport.jsx` — result screen now links to `/missions` (was `/`)
- `src/services/api.js` — `driversApi.counts()`, `driversApi.merge()` (Task 9)
- `src/i18n/locales/en.json`, `fr.json` — every new string in both

### Not modified (deviation)
- `src/constants/exportColumns.js` — this module is **not imported anywhere** (dead). The mission/gendarmerie columns live in `src/constants/missionExportColumns.js` instead of extending a dead file.

## Tasks

### Task 1 — Routes (`src/App.jsx`, 180 lines)

`App.jsx` uses `BrowserRouter` + `ProtectedRoute` + `PermittedRoute scope=`. Add two routes next to `/vehicles`:

```jsx
import MissionsList from './pages/missions/MissionsList'
import MissionDetail from './pages/missions/MissionDetail'

// inside <Routes>, alongside the vehicles routes:
<Route path="/missions" element={<PermittedRoute scope="missions"><MissionsList /></PermittedRoute>} />
<Route path="/missions/:id" element={<PermittedRoute scope="missions"><MissionDetail /></PermittedRoute>} />
```

### Task 2 — Sidebar (`src/components/layout/Sidebar.jsx`, 130 lines)

Add a 5th item to `navItems` (spec §11). Keep the `SF_PROPS = { strokeWidth: 1.75, fill: 'none' }` icon convention.

```jsx
{ icon: Route, label: t('sidebar.missions'), path: '/missions', scope: 'missions' }
```

Import the icon from `@untitledui/icons` (e.g. `Route` or `Map`). Items are filtered by `can(item.scope)`.

### Task 3 — Missions list (`src/pages/missions/MissionsList.jsx`)

Read-only list over `missionsApi.list(filters)`. Structure mirrors `VehiclesList.jsx`:

- **KPI row** (Card): total missions, total MAD, gendarmerie count, needs-review count.
- **Filters** (`MissionFilters.jsx`): date range, departure, destination, vehicle chip, driver, gendarmerie toggle, needs-review toggle, plus a text search over `om`/`destination`.
- **Table**: `OM`, date départ, départ → destination, vehicle chip, driver, amount (sum of that mission's expenses), gendarmerie badge.
- **Vehicle chip** shows `vehicles.code`, else `ledger_vehicles.plate_norm`, else `vehicle_label` (spec §11). Clicking navigates to `/missions/:id`.
- **Export button** reuses the `generateCSV`/`generateExcel`/`generatePDF` + `downloadFile` helpers from `src/utils/parsers.js`.

Row click → `/missions/:id` (deep-linkable, like `/vehicles/:code`).

### Task 4 — Mission detail (`src/pages/missions/MissionDetail.jsx`)

`missionsApi.get(id)` returns the header + children. Layout:

- Header card: OM, date départ / arrivée, route (`départ → destination`, `a_travers`), `date_reglement`, gendarmerie badge.
- Vehicle table: one row per `mission_vehicles` — vehicle chip, `ledger_code`, `Type Véhicule`, driver (name + code), `distance`, `durée`, `bordereau`.
- Expense lines grouped by `expense_categories` (`name_fr`/`name_en` by locale) with per-category subtotals and a grand total; `needs_review` lines flagged.
- `Observation` block per vehicle (preserve line breaks).
- Unknown vehicle renders as a first-class state (chip text = `vehicle_label`), not an error.

### Task 5 — Review queues

Two queues, both reachable from `MissionsList` (a "À revoir" panel or filter):

- **Expense review**: `missionExpensesApi.listNeedsReview()` → 9 rows / 3,368.00 MAD (from Plan 2). Show `om`, `source_column`, `parsed_label`, `amount`, and a link to the mission.
- **Unknown vehicles**: `mission_vehicles` where both `vehicle_id` and `ledger_vehicle_id` are null → the 12 planned + any override misses. Show `om`, `vehicle_type_raw`, `vehicle_label`.

These are read-only views; resolution is manual/out-of-band for now (spec §13.1–13.2).

### Task 6 — Gendarmerie export (`src/pages/export/Export.jsx`, 873 lines)

Add a 5th entry to `EXPORT_TYPES` (spec §11, §9):

```jsx
{
  id: 'gendarmerie',
  icon: Shield,               // from @untitledui/icons
  titleKey: 'export.typeGendarmerie',
  descKey: 'export.typeGendarmerieDesc',
  defaultColumns: ['om', 'date_depart', 'depart', 'destination', 'vehicle', 'driver', 'amount'],
  includeCharges: false,
  gendarmerie: true,
}
```

Behaviour, gated on `exportType === 'gendarmerie'`:

- Load missions with `gendarmerie_required = true` (13 OMs on the Plan-2 snapshot).
- **Level toggle** (in `GendarmerieExport.jsx`): `charge-level` = the gendarmerie-attributable money — lines whose `expense_category.code ∈ {escorte_gendarmerie, gasoil, repas}` on any vehicle, **plus the entire cost of the escort vehicle itself** (its driver/label marks the gendarmerie escort; this captures its `frais de route`, which is the escort fee); `mission-level` = every line of the OM. Totals are computed live (snapshot values were 78,141 and 100,116.50 MAD — not hardcoded).
- Excluded at charge level per spec §9: hotel waiting 1,300 · procès 600 · crevaison 160 · lampe/plaque 75 · OM 160399 envoi papiers 175.
- OM 160399 does **not** appear (no `GENDARM` match).
- Export via the existing CSV/Excel/PDF path; filename prefix `SMG-Gendarmerie-<level>`.

### Task 7 — Export columns sync (`src/constants/exportColumns.js`, 68 lines)

Add a `GENDARMERIE` column set (keys used above) and keep `Export.jsx`'s column lists in sync, as the file already documents for `VEHICLE`/`OTHER`.

### Task 8 — i18n (`src/i18n/locales/en.json`, `fr.json`)

Add to **both** locales (parity is a verification item):

- `sidebar.missions` (already added in Plan 1 only for the permission label — ensure the sidebar key exists too)
- `missions.*`: title, kpi labels, filter labels, table headers, status badges, empty states, review-queue labels
- `export.typeGendarmerie`, `export.typeGendarmerieDesc`, `export.gendLevelCharge`, `export.gendLevelMission`, `export.gendTotal`
- Reuse `settings.permMissions` (Plan 1) and `missions.gendarmerieRequired`.

### Task 9 — Driver merge (optional, open item §13.1) — DONE

Expose the Appendix-A candidate merges as an in-app merge (pick survivor → rewrite `mission_vehicles.driver_id` → retire the loser). **Never auto-merged.** See Outcome for the implementation and the two deviations (grouped rather than paired; needs the `import` scope to write).

## Verification

- `npm run build` after each task (`dist/` regenerates; committed artifact).
- Manual (spec §12):
  - Sidebar shows 5 items: dashboard, vehicles, import, export, missions.
  - A user without the `missions` scope cannot open `/missions` (redirect via `PermittedRoute`).
  - `/missions` filters combine; deep link `/missions/:id` reloads correctly.
  - Vehicle chip falls back `code` → `plate_norm` → `vehicle_label`; the 12 unknown vehicles render without error.
  - Review queues show 9 expense rows / 3,368.00 and the unknown-vehicle rows.
  - Gendarmerie export: OM 160399 absent; charge-level includes only lines on `{escorte_gendarmerie, gasoil, repas}`; mission-level sums every line of the OM; CSV/Excel/PDF all download. (Totals are computed from live data — 78,141 / 100,116.50 are the Plan-2 snapshot values, not assertions.)
  - EN/FR parity, dark mode, mobile, no console errors.

## Outcome

### Deviations from the sketch

- **The gendarmerie export is a self-contained panel, not extra steps in the vehicle flow.** Selecting the new type card renders `GendarmerieExport` in place of the vehicle stepper (`exportType === 'gendarmerie'` branch in `Export.jsx`); Back returns to `vehicles-charges`. The vehicle/filter/columns/generate code paths are untouched.
- **No hardcoded totals.** Charge-level uses the explicit category codes; mission-level sums the OM. Both are computed from the loaded data.
- **Review queues are computed client-side** from the already-loaded mission list (filter toggles + a two-tab panel), so no extra query beyond `missionsApi.list()`. `missionExpensesApi.listNeedsReview()` exists but is not needed by the list page (the detail page also shows the flag inline).
- **`exportColumns.js` was not extended** (dead module); mission columns live in `src/constants/missionExportColumns.js`.
- **Task 9 (driver merge) is implemented, not deferred.** Two deviations from the sketch:
  - The Appendix-A candidates are modelled as **groups** (2–3 spellings), not pairs, because two of them are genuinely 3-way (`RACHID/RACHIDI/RACHDI MOHAMED`, `CHAIT/ECHAIT/ECHAYET MOHAMED`). A group yields all its losers merged into the chosen survivor in one action. ~27 groups / ~31 implied pairs.
  - Merging **writes**, and RLS gates all the relevant writes on the `import` scope (not `missions`). `/missions/drivers` is therefore reachable with `missions` (read the drivers) but the merge actions are disabled and a banner explains the `import` requirement when it is missing. This is the same permission coupling the import wizard has, mirrored.
  - Merge semantics (in `src/utils/mergeDrivers.js`): repoint `mission_vehicles` (and sync the denormalised `driver_name`/`driver_code`), **delete the loser first** (so its UNIQUE `code` frees up), then have the survivor adopt the loser's code if it had none, otherwise record it in `alt_codes`.

### Verification

- `npm run build` green after every task.
- Schema cross-checked against the live DB: `missions.gendarmerie_required`, and every `mission_vehicles` / `mission_expenses` / `drivers` / `ledger_vehicles` column used by the pages/API exist (via `information_schema.columns`). `expense_categories` exposes `code`, `name_fr`, `name_en`, `source_column`.
- EN/FR flat-key parity verified (703 = 703, no one-sided keys), and every static `t('…')` key used by the new/changed files resolves in both locales.
- Merge logic unit-tested against an in-memory mock PostgREST client (`_vmerge.mjs`, deleted): repointing, loser deletion, code adoption when the survivor had none (delete-before-adopt ordering), `alt_codes` folding, and error propagation — all pass ("RESULT: merge logic OK").
- Data-dependent checks remain **pending the Plan-2 import** (tables are empty): the manual items listed under Verification above.

## Done

After Plan 3, all three plans are complete: schema + RLS (Plan 1), data loaded (Plan 2), and the read-only Missions module + gendarmerie export + driver-merge tool live (Plan 3). Remaining open items are the manual review queues and the security findings noted in spec §13 (out of scope).
