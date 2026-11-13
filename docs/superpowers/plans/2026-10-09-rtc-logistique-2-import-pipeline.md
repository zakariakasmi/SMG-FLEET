# 2026-10-09 — RTC Logistique · Plan 2: Import pipeline + JS parser port

Source of truth: `docs/superpowers/specs/2026-10-09-rtc-logistique-design.md` §3–§9, §11. Depends on Plan 1 (tables, seed, RLS, `import` scope). This plan stages the sheet in the browser, ports the Python catch-all parser to JS, resolves vehicles/drivers, and writes `missions` / `mission_vehicles` / `mission_expenses` / `ledger_vehicles` / `drivers`.

## Status: EXECUTED (2026-10-12)

All six tasks are implemented. Deviations from the sketch below, and the verification evidence, are recorded at the end of this file under **Outcome**.

> **The sheet is live and was edited during this work.** The figures quoted in the task sketches (`5,126` rows, `4,491` missions, `1,963,111.58`, `504/146,203.00`) were a snapshot. The current sheet yields `5,145` rows / `4,510` missions / `1,968,382.58` raw. **No total is hardcoded**; the importer computes its invariant from the same rows it writes, so the wizard is correct against whatever the sheet contains at import time. The Task 1 parser *gate* (504 exact / 146,203.00) was still met exactly — see Outcome.

## Global constants

Reuse the app's existing Excel/parse utilities. No new deps. Parser port must reproduce the Python prototype's **504 exact / 9 review / 146,203.00 exact MAD** result exactly against the live sheet (`$env:TEMP\spF.py` + `$env:TEMP\mkF.py`). Add nothing to `package.json`.

Column headers are case-sensitive and must be read verbatim: `OM`, `Date depart`, `Depart`, `Destination`, `A travers`, `MATRICULE`, `Type Véhicule`, `Mlle`, `Nom`, `N° bordoreau`, `Description`, `Date arriver`, `Distance`, `Durée`, `Date reglement`, `Auto route`, `Hotel`, `frais de route`, `Gardinnage`, `Divers`, `Procès`, `GASOIL`, `DÉPLACEMENT COMPLEMENTAIRE`, `Observation`, `Nature de Charge`, `CODE`.

## Files

### New
- `src/utils/ledgerParser.js` — JS port of `spF.py` + `mkF.py::lines_for`
- `src/utils/ledgerImport.js` — plate/om normalization, bucket resolution, row → DB records
- `supabase/2026-10-09-rtc-logistique-overrides.sql` — seed the 2 vehicle overrides

### Modified
- `src/services/api.js` — add `missionsApi`, `missionExpensesApi`, `expenseCategoriesApi`, `ledgerVehiclesApi`, `driversApi`
- `src/pages/import/Import.jsx` — add ledger mode (skips `mapping`)
- `src/i18n/locales/en.json`, `fr.json` — import-mode strings

## Tasks

### Task 1 — Port the parser (`src/utils/ledgerParser.js`)

Create the module below. It is a line-for-line port of `spF.py` (Python `re` named groups `(?P<x>…)` become JS `(?<x>…)`; `finditer` becomes `matchAll`; defaultdict becomes `Map`).

```js
const EXPENSE_COLUMNS = ['Auto route', 'Hotel', 'frais de route', 'Gardinnage', 'Divers', 'Procès', 'GASOIL', 'DÉPLACEMENT COMPLEMENTAIRE']
const FIXED_COLUMNS = ['Auto route', 'Hotel', 'frais de route', 'Gardinnage', 'Procès', 'GASOIL']
const CATCH_ALL = ['Divers', 'DÉPLACEMENT COMPLEMENTAIRE']

export const fold = (x) =>
  (x || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')

export function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return v
  let t = String(v).replace(/\u202f/g, '').replace(/\u00a0/g, '').replace(/ /g, '')
  if (t === '' || t === '-') return 0
  if (t.includes(',') && !t.includes('.')) t = t.replace(',', '.')
  const n = parseFloat(t)
  return Number.isNaN(n) ? 0 : n
}

const PAT = /(?<bare>(?:=|:)\s*(?<n1>[0-9][0-9 .\u202f\u00a0,]*?)\s*(?:D{1,2}H\b|D\.H\.?|(?=\s*(?:\)|\(|-|\/|,|$)))|(?<dh>(?<![0-9])(?<n2>[0-9][0-9 .\u202f\u00a0,]*?)\s*(?:D{1,2}H\b|D\.H\.?)))/gi

export function parseObservation(o) {
  const out = []
  let pos = 0
  for (const m of o.matchAll(PAT)) {
    if (m.index < pos) continue
    const raw = m.groups.n1 ?? m.groups.n2
    let lab = o.slice(pos, m.index)
    pos = m.index + m[0].length
    lab = lab.replace(/^\s*[-+/,]\s*|\s*[-+/,]\s*$/, ' ')
    lab = lab.replace(/\s*[:=]\s*$/, '').trim().replace(/^=+/, '').trim()
    let t = raw.replace(/\u202f/g, '').replace(/\u00a0/g, '').replace(/ /g, '')
    if (t.includes(',') && !t.includes('.')) t = t.replace(',', '.')
    const v = parseFloat(t)
    if (!Number.isNaN(v) && v > 0 && lab) out.push([lab.replace(/\s+/g, ' '), v])
  }
  return out
}

export function labelOf(o) {
  let t = o.replace(PAT, ' ')
  t = t.replace(/[=:]/g, ' ')
  t = t.replace(/\s*[-+/]\s*(?=FRAIS|PROCE|NB\b|TAXI|REPAS|PESAGE|CHARGE|DEGAG|EVACU|LAVAGE|ACHAT|GARIN)/gi, ' | ')
  return t.split('|')
    .map((x) => x.replace(/\s+/g, ' ').trim().replace(/^[\s\-—/:()]+|[\s\-—/:()]+$/g, ''))
    .filter((x) => /[A-Za-z]{3,}/.test(x))
}

const RULES = [
  [/TRANSPORT\s+PAR\s+(?:CTM|TARIN|AUTO-?CAR|CAR)|AUTOCAR/, 'autocar'],
  [/TRANSPORT\s+PAR\s+(?:TRAIN|TGV)|\bTGV\b|\bTRAIN\b/, 'train'],
  [/TAXI/, 'taxi'],
  [/DEGAGEMENT|DEBARRASSAGE|DEBARRAGE|EVACUATION|ORDURE|DECHET|GRAVAT|DEBLAI/, 'evacuation_dechets'],
  [/CHARGEMENT.*CIMENT|CHARGE.*CIMENT/, 'chargement_ciment'],
  [/PESAGE|PEUSAGE|PESSAGE/, 'pesage'],
  [/CREVAISON|CREVAISION|CREUVAISON|CHANGE PNEUS/, 'crevaison'],
  [/PROCES|PROCE\b|TACHYGRAPHE|HORS GABARIT|AMENDE/, 'proce'],
  [/EXTINCTEUR|EXTEINCTEUR/, 'extincteur'],
  [/PNEU|EQUIL.?BRAGE/, 'pneus'],
  [/BAGAGE/, 'bagage'],
  [/DOUANE|DEOUANE/, 'douane'],
  [/LAVAGE|NETTOY/, 'lavage'],
  [/REPARATION|SOUDURE|SONDURE/, 'reparation'],
  [/ACHAT|FOURNITURE|IMPRIM|RECEPTION COLIS/, 'achat'],
  [/ENVOI|POSTAL|COURRIER/, 'postal'],
  [/PARKING|STATIONN/, 'parking'],
  [/MAIN D.OEUVRE|CHARGE ARGANE/, 'main_oeuvre'],
  [/HOTEL|HEBERG/, 'hotel'],
  [/REPAS|DEJEUNER|DINER/, 'repas'],
  [/GARDI?ENN?AGE/, 'gardinnage'],
  [/AUTO\s*ROUTE|P(?:E|É)AGE/, 'auto_route'],
  [/ESSENCE|GAZOIL|CARBURANT/, 'gasoil'],
  [/ROUTE|ITINERAIRE/, 'frais_de_route'],
  [/TRANSPORT/, 'transport_personnes'],
  [/IMMATRICUL|PLAQUE\s+LIMITE/, 'achat'],
  [/CLE\s+CONTACT/, 'achat'],
  [/CHARIOT\s+AEROPORT/, 'divers'],
  [/LEGALISATION|COURSES|BON POUR TRAVAUX|VISITE/, 'frais_admin'],
]

const DESC_RULES = [
  [/CIMENT/, /CHARGEMENT|CHARGE\b/, 'chargement_ciment'],
  [/GRAVAT|GRAVAS|POUBELLE|ORDURE|DECHET|DEBLAI/, /DEGAGEMENT|EVACUATION|CHARG/, 'evacuation_dechets'],
  [/\bTRAIN\b|\bTGV\b/, /TRANSPORT/, 'train'],
  [/\bCTM\b|\bCAR\b|AUTOCAR/, /TRANSPORT/, 'autocar'],
]

export function classify(lab, om, gendOms, desc = '') {
  const u = fold(lab).toUpperCase().replace(/'/g, '')
  if (gendOms.has(om) && /GENDARM|MOTO\s+D?\'?E?S?C?O?R?T?/.test(u)) return 'escorte_gendarmerie'
  if (/^FRAIS\s+DE\s+REPAS/.test(u)) return 'repas'
  if (/^FRAIS\s+D[' ]ESSENCE/.test(u)) return 'gasoil'
  for (const [p, c] of RULES) if (p.test(u)) return c
  const d = fold(desc).toUpperCase()
  if (d) for (const [dp, lp, c] of DESC_RULES) if (dp.test(d) && lp.test(u)) return c
  return 'divers_inconnu'
}

const CAND = {
  proce: ['Procès'], hotel: ['Hotel'], gasoil: ['GASOIL'], frais_de_route: ['frais de route'],
  auto_route: ['Auto route'], gardinnage: ['Gardinnage'],
  autocar: ['DÉPLACEMENT COMPLEMENTAIRE', 'Divers'],
  train: ['DÉPLACEMENT COMPLEMENTAIRE', 'Divers'],
  taxi: ['DÉPLACEMENT COMPLEMENTAIRE', 'Divers', 'Auto route'],
  repas: ['Divers', 'DÉPLACEMENT COMPLEMENTAIRE'], crevaison: ['Divers'], lavage: ['Divers'],
  achat: ['Divers'], reparation: ['Divers'], postal: ['Divers'], parking: ['Divers'],
  pesage: ['Divers', 'frais de route'], evacuation_dechets: ['Divers'], chargement_ciment: ['Divers'],
  extincteur: ['Divers'], pneus: ['Divers'], bagage: ['Divers'], douane: ['Divers'],
  main_oeuvre: ['Divers'], frais_admin: ['Divers'],
  transport_personnes: ['Divers', 'DÉPLACEMENT COMPLEMENTAIRE'],
  escorte_gendarmerie: ['Divers', 'DÉPLACEMENT COMPLEMENTAIRE', 'frais de route', 'GASOIL', 'Auto route'],
  divers: ['Divers', 'DÉPLACEMENT COMPLEMENTAIRE'],
  divers_inconnu: ['Divers', 'DÉPLACEMENT COMPLEMENTAIRE'],
}
```

Then append the catch-all record builder (port of `spF.py` lines 86–131). It returns one record per `(row, booked column)`:

```js
const toIso10 = (v) => (v ? String(v).slice(0, 10) : null)

export function buildCatchAllRecords(rows) {
  const gendOms = new Set(
    rows.filter((r) => r.Observation && /GENDARM/i.test(String(r.Observation))).map((r) => r.OM)
  )
  const records = []
  for (const r of rows) {
    const o = String(r.Observation || '')
    const d = String(r.Description || '')
    const items = parseObservation(o)
    const booked = Object.fromEntries(EXPENSE_COLUMNS.map((c) => [c, toNumber(r[c])]))
    const have = CATCH_ALL.filter((c) => booked[c] > 0)
    if (!have.length) continue

    let src = []
    if (items.length) src = items.map(([l, v]) => [l, v, classify(l, r.OM, gendOms, d)])
    else {
      outer: for (const c of have) {
        for (const L of o ? labelOf(o) : []) {
          const k = classify(L, r.OM, gendOms, d)
          if (k !== 'divers_inconnu') { src.push([L, booked[c], k]); break outer }
        }
      }
    }

    if (!src.length) {
      for (const c of have) records.push(record(r, c, booked[c], 0, 'unparseable', {}, o, d))
      continue
    }

    const cols = EXPENSE_COLUMNS.filter((c) => booked[c] > 0)
    const fb = CATCH_ALL.filter((c) => cols.includes(c))
    const cand = src.map(([, , k]) => {
      const pc = (CAND[k] || ['Divers']).filter((x) => cols.includes(x))
      return pc.length ? pc : (fb.length ? fb : ['Divers'])
    })
    const res = new Array(src.length).fill(null)
    const bt = (i, s) => {
      if (i === src.length) return true
      for (const c of cand[i]) {
        if (s[c] + src[i][1] <= booked[c] + 0.01) {
          s[c] += src[i][1]; res[i] = c
          if (bt(i + 1, s)) return true
          s[c] -= src[i][1]; res[i] = null
        }
      }
      return false
    }
    const s0 = Object.fromEntries(EXPENSE_COLUMNS.map((c) => [c, 0]))
    if (!bt(0, s0)) {
      for (const c of have) records.push(record(r, c, booked[c], 0, 'no-fit', {}, o, d))
      continue
    }
    for (const c of have) {
      const idx = src.map((_, i) => i).filter((i) => res[i] === c)
      const got = idx.reduce((a, i) => a + src[i][1], 0)
      const cats = {}; const det = []
      for (const i of idx) { cats[src[i][2]] = (cats[src[i][2]] || 0) + src[i][1]; det.push(`${src[i][2]}: ${src[i][0]}=${src[i][1].toFixed(2)}`) }
      const st = Math.abs(got - booked[c]) < 0.01 ? 'exact' : got === 0 ? 'empty' : got < booked[c] ? 'solde' : 'over'
      const rec = record(r, c, booked[c], round2(got), st, cats, o, d)
      rec.detail = det.join(' | ')
      records.push(rec)
    }
  }
  return { records, gendOms }
}

const round2 = (n) => Math.round(n * 100) / 100
function record(r, col, booked, parsed, status, cats, obs, desc) {
  return { om: r.OM, date: toIso10(r['Date depart']), col, booked, parsed, status, cats, detail: '', obs: obs.trim().replace(/\n/g, ' '), desc }
}

// Port of mkF.py::lines_for for Option B (split everything, residual explicit).
export function linesFor(rec) {
  if (rec.status !== 'exact') return [['divers', rec.booked, '(inchangé)']]
  let out = []
  for (const d of (rec.detail || '').split(' | ')) {
    const m = d.match(/^(.*?):\s*(.*?)\s*=\s*([\d.,]+)$/)
    if (m) out.push([m[1], parseFloat(m[3].replace(',', '.')), m[2]])
  }
  if (out.some(([, a]) => a > rec.booked + 0.01)) return [['divers', rec.booked, '(inchangé)']]
  out = out.map(([c, a, l]) => [c, round2(a), l])
  const rem = round2(rec.booked - out.reduce((s, [, a]) => s + a, 0))
  if (Math.abs(rem) >= 0.005) {
    if (rem > 0) out.push(['divers', rem, 'solde non expliqué'])
    else { const [, a, l] = out[out.length - 1]; out[out.length - 1] = [out[out.length - 1][0], round2(a + rem), l] }
  }
  return out
}
```

**Verify the port before wiring the UI.** With a throwaway Node script (not committed), load `$env:TEMP\gsheet_live.csv` (the live sheet), filter to `Date depart >= 2025-01-01`, run `buildCatchAllRecords`, and print the status counts + exact MAD:

```
records=513
  exact n=504 146203.00 (parse=146203)
  unparseable n=4 860.00
  no-fit n=5 2508.00
```
Any other number = port bug; fix before continuing. Also assert `linesFor` produces 0 `solde non expliqué` lines across all 513 records (Python produced 0).

### Task 2 — Seed vehicle overrides

Create `supabase/2026-10-09-rtc-logistique-overrides.sql`. There is now **one** override: the §5.3 row recovers a plate for a mission whose `MATRICULE` and `CODE` are both `-`. (OM `134236` no longer needs an override — the live sheet now carries its plate `45695-A-7`, bucket C.)

```sql
-- =====================================================
-- RTC Logistique — import_vehicle_overrides (§5.3)
-- =====================================================
INSERT INTO import_vehicle_overrides (om, date_depart, line_no, plate_raw, code_raw, note) VALUES
  ('142358', '2025-01-10', 1, '54134-B-7', 'CTR44', 'override: plateless row, in fleet (bucket A)')
ON CONFLICT (om, date_depart, line_no) DO NOTHING;
```

`date_depart = 2025-01-10` is confirmed from the live sheet (OM 142358). **Before applying, re-confirm with the SQL tool** (`select om, date_depart from missions where om = '142358'` once missions exist, or read it from the sheet with the Task 1 script) — `date_depart` is part of the unique key. `line_no = 1` because OM 142358 is a single-line group.

### Task 3 — Importer (`src/utils/ledgerImport.js`)

Exports the normalization helpers and the record builder. Port `normalizePlate` per §5 (NFKD, uppercase, strip non-alphanumeric).

```js
import { buildCatchAllRecords, linesFor, EXPENSE_COLUMNS, CATCH_ALL, FIXED_COLUMNS, toNumber } from './ledgerParser'
import { fold } from './ledgerParser'

export const normalizePlate = (raw) => fold(String(raw || '')).toUpperCase().replace(/[^A-Z0-9]/g, '')
export const normalizeOm = (v) => String(v ?? '').trim().replace(/\.0+$/, '')
const iso10 = (v) => (v ? String(v).slice(0, 10) : null)
const normName = (v) => fold(String(v || '')).toUpperCase().replace(/\s+/g, ' ').trim()

// rows: in-scope raw rows (already Date depart >= 2025-01-01).
// fleetByPlate: Map<normPlate, {id, code}>
// overrides: Map<`${om}|${date}|${line}`, {plate_raw, code_raw}>
export function buildLedgerImport(rows, { fleetByPlate, overrides, categoryByCode }) {
  const missionsByKey = new Map()
  const ledgerByPlate = new Map()
  const driversByName = new Map()
  const driversByCode = new Map()
  const perRow = []

  // 1. group rows by (om, date) in source order; assign line_no within group.
  const groups = new Map()
  rows.forEach((r) => {
    const om = normalizeOm(r.OM)
    const date = iso10(r['Date depart'])
    const key = `${om}|${date}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
    if (!missionsByKey.has(key)) {
      missionsByKey.set(key, {
        om, date_depart: date, depart: r.Depart || null, destination: r.Destination || null,
        a_travers: r['A travers'] || null, date_arriver: iso10(r['Date arriver']),
        date_reglement: iso10(r['Date reglement']), gendarmerie_required: false,
      })
    }
  })

  const { records } = buildCatchAllRecords(rows)
  const catchByRow = new Map()
  // index catch-all records by (om,date,line_no) — recompute line_no deterministically:
  for (const [key, group] of groups) group.forEach((r, i) => catchByRow.set(`${key}|${i + 1}`, []))

  let lineCursor = new Map()
  for (const r of rows) {
    const om = normalizeOm(r.OM); const date = iso10(r['Date depart'])
    const gkey = `${om}|${date}`
    const line = (lineCursor.get(gkey) || 0) + 1
    lineCursor.set(gkey, line)
    const rkey = `${gkey}|${line}`

    let plateNorm = normalizePlate(r.MATRICULE)
    let ledgerCode = r.CODE ? normalizeOm(r.CODE) : null
    const ov = overrides.get(rkey)
    if (ov) { plateNorm = normalizePlate(ov.plate_raw); ledgerCode = ov.code_raw || ledgerCode }

    let vehicle_id = null, ledger_vehicle_id = null
    if (plateNorm && fleetByPlate.has(plateNorm)) {
      vehicle_id = fleetByPlate.get(plateNorm).id
    } else if (plateNorm) {
      if (!ledgerByPlate.has(plateNorm)) ledgerByPlate.set(plateNorm, { plate_norm: plateNorm, plate_raw: r.MATRICULE || ov?.plate_raw || null })
      ledger_vehicle_id = plateNorm // resolved to id after insert
    }

    // driver
    const nameNorm = normName(r.Nom)
    const code = r.Mlle != null && r.Mlle !== '' ? normalizeOm(r.Mlle) : null
    let driverKey = null
    if (nameNorm) {
      if (!driversByName.has(nameNorm)) driversByName.set(nameNorm, { name_norm: nameNorm, name: String(r.Nom).trim(), code, alt_codes: [] })
      else if (code && !driversByName.get(nameNorm).code) driversByName.get(nameNorm).code = code
      driverKey = nameNorm
    } else if (code) {
      if (!driversByCode.has(code)) driversByCode.set(code, { name_norm: null, name: null, code, alt_codes: [] })
      driverKey = code
    }

    perRow.push({
      gkey, line, vehicle_type_raw: r['Type Véhicule'] || null,
      vehicle_label: !plateNorm ? (r['Type Véhicule'] || 'Inconnu') : null,
      ledger_code: ledgerCode, driverKey, driver_code: code, driver_name: r.Nom || null,
      bordereau: r['N° bordoreau'] != null ? normalizeOm(r['N° bordoreau']) : null,
      description: r.Description || null, observation: r.Observation || null,
      nature_de_charge: r['Nature de Charge'] || null,
      distance: toNumber(r.Distance) || null, duree: toNumber(r.Durée) || null,
      vehicle_id, ledger_vehicle_id, fixed: Object.fromEntries(FIXED_COLUMNS.map((c) => [c, toNumber(r[c])])),
      catchRecords: [], rkey,
    })
  }

  return { missions: [...missionsByKey.values()], ledgerByPlate, driversByName, driversByCode, perRow, catchRecords: records }
}
```

The plan deliberately keeps the DB write itself in `Import.jsx` (Task 4) so the wizard owns transactions/progress, but the joins are assembled here.

### Task 4 — Ledger import mode in `Import.jsx`

`src/pages/import/Import.jsx` (1,051 lines): add `importType === 'ledger'`.

1. In the type-selection step add a third card ("Missions RTC — relevé 2025"). Ledger mode forces sheet `2025` if present.
2. Ledger mode **skips** `mapping` (schema fixed): `STEP_ORDER` becomes `['upload', 'review', 'result']` when `importType === 'ledger'`.
3. On file load, read rows, filter `Date depart >= '2025-01-01'`, normalize `OM`/`N° bordoreau`.
4. Load references: all `vehicles` (`id, code, registration_plate`) → `fleetByPlate`; `import_vehicle_overrides` → map; `expense_categories` → `categoryByCode` by `code`.
5. Call `buildLedgerImport(...)`.
6. Upsert order (use `api.js`):
   - `drivers` on `name_norm` (and the code-only row on `code`), then `ledger_vehicles` on `plate_norm`, then `missions` on `(om,date_depart)`, then `mission_vehicles` (delete-then-insert per `mission_id` for idempotency), then `mission_expenses` (delete by touched `mission_vehicle_id`, then insert).
   - Map `ledger_vehicle_id` from `plate_norm` to the inserted id before writing `mission_vehicles`.
   - Build `mission_expenses`: fixed columns → one line each where `> 0`, `source_column` = the Excel column; catch-all records → `linesFor(rec)` lines with `source_column` = `rec.col` and `parsed_label` = the fragment, `needs_review = rec.status !== 'exact'`.
   - Set `missions.gendarmerie_required = true` for `gendOms`.
7. **Verify the fixed-column total invariant in-code** before writing: sum of the 6 fixed columns over all rows + catch-all booked total must equal `1,963,111.58`; abort the import with a toast if not.
8. On success, insert into `import_logs` (existing table) with `type`/counts + `error_details` jsonb (`{missions, mission_vehicles, mission_expenses, needs_review}`).

### Task 5 — API additions (`src/services/api.js`)

Follow the `vehiclesApi` pattern (`supabase.from(t).select(...)`, chained filters, throw on `error`). Add:

- `missionsApi.list(filters)` — join `depart`/`destination`/`om` filters, date range, gendarmerie, plus pagination like `vehiclesApi.search`.
- `missionsApi.get(id)` — mission + `mission_vehicles` (+ resolved vehicle/ledger/driver) + `mission_expenses` (+ category).
- `missionExpensesApi.listNeedsReview()`.
- `expenseCategoriesApi.list()`.
- `ledgerVehiclesApi` / `driversApi` — minimal `list()` used by the importer and detail chips; `driversApi.merge(sourceId, targetId)` stub for the open merge item (may land in Plan 3).

### Task 6 — i18n

Add to **both** locales: the ledger type card, the ledger review column labels, and import progress/result strings (`import.ledgerTitle`, `import.ledgerDesc`, `import.ledgerInScope`, `import.ledgerImporting`, `import.ledgerDone`, `import.ledgerMismatch`). FR and EN keys must be identical.

## Verification

- Parser port (Task 1): throwaway Node run reproduces `exact 504 / 146,203.00`, `unparseable 4 / 860.00`, `no-fit 5 / 2,508.00`, 0 solde lines.
- `npm run build` succeeds after Tasks 4–6 (`dist/` regenerates).
- After running the wizard against the sheet, SQL assertions (spec §12):
  - `count(missions)`/`count(mission_vehicles)`/`count(mission_expenses)` equal the wizard's pre-flight numbers.
  - `sum(amount) = grandTotal`; `sum(amount) where needs_review = needsReviewAmount`.
  - bucket A/B/C/neither row counts and amounts match the wizard.
  - every `(mission_vehicle_id, source_column)` group sums to the sheet column total (the §12 balance assertion).
- Re-run the wizard twice: counts unchanged (idempotency).
- Manual: sidebar/routes not touched in this plan; the import wizard shows 3 type cards and the ledger path never shows the mapping step.

## Outcome

### Deviations from the sketch

- **Write orchestration lives in `src/utils/runLedgerImport.js`, not in `Import.jsx`.** It takes an injectable `api` (lazy-imports the real one) so the write sequence — batching, id mapping, FK links — is testable without a browser/session.
- **UI lives in `src/pages/import/LedgerImport.jsx`**, rendered by `Import.jsx` when `importType === 'ledger'`. The vehicles/charges flow is untouched.
- **Task 4.7 guard is self-consistent, not hardcoded.** `buildLedgerImport` returns `problems[]`: any expense line with a null `expense_category_id` or `amount <= 0`, any fixed+catch ≠ grand total, or an empty mission set blocks the write with a toast. Totals are computed from the rows passed in, so the guard works against the live (moving) sheet.
- **`Somme des OM` cross-check added.** `totals.sommeTotal` = Σ of the sheet's own SUM column; `sommeDelta = sheetTotal - sommeTotal`. A non-zero delta is surfaced in the review panel (and does *not* block). Currently `+16.00` from the malformed `Auto route='16/,20'` cell on OM `148495` — the raw columns are imported.
- **`import_vehicle_overrides` is seeded by SQL** (`supabase/2026-10-09-rtc-logistique-overrides.sql`), not read from the sheet. One row: OM `142358` / `2025-01-10` / line 1 → `54134-B-7` / `CTR44`.
- **`ledger_vehicles`/`drivers` are upserted** (ids stable across re-runs); **`missions` are deleted by `source='google_2025'` then re-inserted** (idempotent); `mission_vehicles`/`mission_expenses` cascade from `missions`.

### Evidence

- **Parser port exact.** A three-step throwaway harness (export in-scope rows → run the Python prototype verbatim → diff every field/cats/detail) reported: `RESULT: JS parser output is IDENTICAL to Python prototype`. On the frozen snapshot: 513 records = 504 exact / 146,203.00 · 4 unparseable / 860 · 5 no-fit / 2,508 · 0 `solde non expliqué`. `linesFor` also matched `mkF.py::lines_for` exactly (819 lines, 0 solde, 149,571.00).
- **Importer reconciles** (live sheet `gsheet_now.csv` + 440-row fleet): `Σ(lines) = grandTotal = sheetTotal`; `fixedTotal + catchTotal = grandTotal`; `problems = 0`; 0 lines with a null category; buckets sum to the total.
- **Write orchestrator verified end-to-end** against an in-memory mock API: counts (missions / mission_vehicles / expenses / drivers / ledger_vehicles) match; every `perRow[i]` maps to the mission and mission_vehicle inserted at index `i`; per-row expense totals match; driver/ledger FKs resolve; no row sets both `vehicle_id` and `ledger_vehicle_id`.
- **Schema verified against the live DB**: `information_schema.columns` + `pg_constraint` for `missions`/`mission_vehicles`/`mission_expenses`/`drivers`/`ledger_vehicles` confirm every column name used by `api.js` and the CHECK/NOT NULL/UNIQUE constraints the payloads must satisfy.

> The verification harnesses were throwaway Node scripts, deleted after use (this repo has no test framework by design). Re-create them from the "Outcome" description if the parser or importer needs to be re-checked.

### Current (live-sheet) baseline — moves with the sheet

Snapshot `gsheet_now.csv` (md5 `58E0DD38…`): 5,145 in-scope rows · 4,510 missions · 5,145 mission vehicles · 9,474 expense lines · 241 drivers · 190 new plates · 13 gendarmerie missions.
Buckets: A 2,882 / 1,333,661.03 · B 877 / 207,674.97 · C 1,309 / 372,298.28 · neither 77 / 54,748.30.
Totals: fixed 1,817,106.58 + catch 151,276.00 = **1,968,382.58** (raw) vs sheet SUM(OM) 1,968,366.58 (Δ 16.00).
Needs review: 9 lines / 3,368.00 (4 unreadable / 860 + 5 no-fit / 2,508).

## Handoff

Plan 3 (Missions UI + gendarmerie export) depends on the data this plan writes and the `missionsApi`/`missionExpensesApi` readers added here. The wizard's result screen now links to `/missions` (done in Plan 3).

**Permission coupling (admin config):** the `/import` route needs the `import` scope, but the wizard's reference reads (`expense_categories`, `vehicles`, `import_vehicle_overrides`) are gated by the `missions` scope per the RLS from Plan 1. Anyone who imports the ledger therefore needs **both** `import` and `missions`. The wizard now fails loudly (`import.ledgerNoReference`) instead of importing nothing when `missions` is missing. Grant both scopes to the RTC users.
