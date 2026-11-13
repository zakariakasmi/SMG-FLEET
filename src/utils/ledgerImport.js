// RTC Logistique — import builder (spec §5, §6, §8, §9).
//
// Turns in-scope sheet rows into the DB-shaped batches the wizard writes:
//   missions · mission_vehicles · mission_expenses · ledger_vehicles · drivers
//
// It keeps all writes out (the wizard owns the transaction/progress) but does
// every join: plate → fleet/ledger bucket, driver → name/code, and the
// fixed-column + Divers/Déplacement catch-all → expense lines.
import {
  buildCatchAllRecords,
  linesFor,
  toNumber,
  fold,
  FIXED_COLUMNS,
} from './ledgerParser.js'

// -----------------------------------------------------
// Normalizers
// -----------------------------------------------------

// `81970-A-13` → `81970A13`. Only used for ledger plates + matching keys; never
// rewrites the 440 fleet rows (spec §5).
export const normalizePlate = (raw) =>
  fold(String(raw ?? '')).toUpperCase().replace(/[^A-Z0-9]/g, '')

export const normalizeOm = (v) => String(v ?? '').trim().replace(/\.0+$/, '')

export const normName = (v) => fold(String(v ?? '')).toUpperCase().replace(/\s+/g, ' ').trim()

// Trim a cell to text, collapsing blanks / single dashes to null.
export const clean = (v) => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (!s || s === '-' || s === '—') return null
  return s
}

// The parser's classify() can return `divers_inconnu`; the DB category is `divers`.
const CATEGORY_ALIASES = { divers_inconnu: 'divers' }
export const categoryCodeFor = (code) => CATEGORY_ALIASES[code] || code

const round2 = (n) => Math.round(Number(n) * 100) / 100

// DD/MM/YYYY (sheet) · YYYY-MM-DD (ISO) · JS Date (xlsx) · Excel serial (xlsx) → YYYY-MM-DD.
// Returns null for blank, unparseable, or impossible calendar dates. Accepting an
// impossible date (e.g. 2025-02-29, 2026-00-27) downstream would make Postgres
// reject the entire 500-row insert with SQLSTATE 22008, so calendar validity is
// enforced here.
const ISO_REAL_RE = /^(\d{4})-(\d{2})-(\d{2})$/
function isoDateIsReal(s) {
  const m = ISO_REAL_RE.exec(s)
  if (!m) return false
  const y = +m[1]
  const mo = +m[2]
  const d = +m[3]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}
export function toIsoDate(v) {
  if (v === null || v === undefined || v === '') return null
  let iso = null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    iso = `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  } else {
    const s = String(v).trim()
    let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
    if (m) {
      iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    } else {
      m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (m) {
        iso = `${m[1]}-${m[2]}-${m[3]}`
      } else if (/^\d+(\.\d+)?$/.test(s)) {
        // Excel serial (1900 date system), 2025-01-01 = 45658.
        const n = Number(s)
        if (n > 20000 && n < 80000) {
          const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
          iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        }
      }
    }
  }
  return iso !== null && isoDateIsReal(iso) ? iso : null
}

// -----------------------------------------------------
// Builder
// -----------------------------------------------------

/**
 * @param rows            in-scope raw sheet rows (Date depart >= 2025-01-01), source order
 * @param fleetVehicles   [{ id, code, registration_plate }]
 * @param overrides       [{ om, date_depart, line_no, plate_raw, code_raw }]
 * @param expenseOverrides [{ om, date_depart, source_column, category_code, amount }]
 * @param expenseCategories [{ id, code, source_column }]
 */
export function buildLedgerImport(rows, { fleetVehicles = [], overrides = [], expenseOverrides = [], expenseCategories = [] } = {}) {
  const fixedColumnToCode = new Map()
  const codeToCategoryId = new Map()
  for (const c of expenseCategories) {
    codeToCategoryId.set(c.code, c.id)
  }
  // Only the six plain columns are "fixed"; Divers / Déplacement complémentaire
  // are parsed by the catch-all engine instead (spec §8) — mapping them here too
  // would double-count them.
  for (const column of FIXED_COLUMNS) {
    const cat = expenseCategories.find((c) => c.source_column === column)
    if (cat) fixedColumnToCode.set(column, cat.code)
  }

  // plate → fleet vehicle, with duplicate detection (spec §5 defensive rule).
  const fleetByPlate = new Map()
  const fleetDupes = new Set()
  for (const v of fleetVehicles) {
    const p = normalizePlate(v.registration_plate)
    if (!p) continue
    if (fleetByPlate.has(p)) fleetDupes.add(p)
    else fleetByPlate.set(p, { id: v.id, code: v.code ? fold(String(v.code)).toUpperCase() : null })
  }

  const overridesMap = new Map()
  for (const o of overrides) {
    overridesMap.set(`${normalizeOm(o.om)}|${toIsoDate(o.date_depart)}|${o.line_no}`, o)
  }

  // Durable expense re-categorisations: key = om|date|source_column → a SET of
  // split lines (a catch-all column can cover several categories). Applied only to
  // the lines the parser flagged as needs_review, so exact splits are untouched.
  const expenseOverridesMap = new Map()
  for (const o of expenseOverrides) {
    if (!o.category_code) continue
    const k = `${normalizeOm(o.om)}|${toIsoDate(o.date_depart)}|${o.source_column}`
    if (!expenseOverridesMap.has(k)) expenseOverridesMap.set(k, [])
    expenseOverridesMap.get(k).push({ code: o.category_code, amount: Number(o.amount) || 0 })
  }

  const missionsByKey = new Map()
  const ledgerByPlate = new Map()
  const driversByName = new Map()
  const driversByCode = new Map()
  const buckets = {} // label → { rows, amount }
  const warnings = []
  const perRow = []

  const bump = (label, amount) => {
    if (!buckets[label]) buckets[label] = { rows: 0, amount: 0 }
    buckets[label].rows += 1
    buckets[label].amount += amount
  }

  const { records: catchRecords, gendOms } = buildCatchAllRecords(rows)
  const catchByRowIndex = new Map()
  for (const rec of catchRecords) {
    if (!catchByRowIndex.has(rec.rowIndex)) catchByRowIndex.set(rec.rowIndex, [])
    catchByRowIndex.get(rec.rowIndex).push(rec)
  }

  const lineCursor = new Map()

  // An impossible date (29/02/2025, month 00, …) is dropped to NULL, never sent to
  // Postgres. Warn so the user knows the value was corrected rather than rejected.
  const pushBadDateWarning = (field, raw, om, date, line) => {
    if (raw === null || raw === undefined || raw === '') return null
    const s = String(raw).trim()
    if (!s) return null
    const dateish =
      /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/.test(s) ||
      /^(\d{4})-(\d{2})-(\d{2})/.test(s) ||
      (/^\d+(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 80000)
    const iso = toIsoDate(s)
    if (iso === null && dateish) {
      warnings.push({ type: 'bad-date', field, raw: s, om, date, line })
    }
    return iso
  }

  rows.forEach((r, idx) => {
    const om = normalizeOm(r.OM)
    const date = toIsoDate(r['Date depart'])
    const gkey = `${om}|${date}`
    const line = (lineCursor.get(gkey) || 0) + 1
    lineCursor.set(gkey, line)
    const rkey = `${gkey}|${line}`

    if (!missionsByKey.has(gkey)) {
      missionsByKey.set(gkey, {
        om,
        date_depart: date,
        depart: clean(r.Depart),
        destination: clean(r.Destination),
        a_travers: clean(r['A travers']),
        date_arriver: pushBadDateWarning('Date arriver', r['Date arriver'], om, date, line),
        date_reglement: pushBadDateWarning('Date reglement', r['Date reglement'], om, date, line),
        gendarmerie_required: gendOms.has(r.OM) || gendOms.has(om),
      })
    }

    // --- plate / vehicle link (override first) ---
    let plateNorm = normalizePlate(r.MATRICULE)
    let ledgerCode = clean(r.CODE)
    const ov = overridesMap.get(rkey)
    if (ov) {
      plateNorm = normalizePlate(ov.plate_raw)
      if (clean(ov.code_raw)) ledgerCode = clean(ov.code_raw)
    } else if (!clean(r.MATRICULE) && rkey) {
      // A row with neither MATRICULE nor CODE and no override — remember it so the
      // wizard can surface it (spec §5.3 "permanently unknown").
      if (!clean(r.CODE)) warnings.push({ type: 'plateless', om, date, line })
    }

    let vehicle_id = null
    let ledger_plate_norm = null
    let bucket = 'neither'
    if (plateNorm && fleetByPlate.has(plateNorm)) {
      if (fleetDupes.has(plateNorm)) {
        bucket = 'ambiguous'
        warnings.push({ type: 'fleet-duplicate', plate_norm: plateNorm, om, date, line })
      } else {
        vehicle_id = fleetByPlate.get(plateNorm).id
        const fleetCode = fleetByPlate.get(plateNorm).code
        const ledgerNorm = ledgerCode ? fold(ledgerCode).toUpperCase().replace(/[^A-Z0-9]/g, '') : null
        bucket = ledgerNorm && fleetCode && ledgerNorm === fleetCode ? 'A' : 'B'
      }
    } else if (plateNorm) {
      ledger_plate_norm = plateNorm
      bucket = 'C'
      if (!ledgerByPlate.has(plateNorm)) {
        ledgerByPlate.set(plateNorm, { plate_norm: plateNorm, plate_raw: clean(r.MATRICULE) || ov?.plate_raw || null })
      }
    }

    // --- driver (Mlle = code, Nom = name) ---
    const name = clean(r.Nom)
    const nameNorm = name ? normName(name) : null
    let code = clean(r.Mlle)
    if (code) code = normalizeOm(code)
    let driverKey = null
    if (nameNorm) {
      if (!driversByName.has(nameNorm)) {
        driversByName.set(nameNorm, { name_norm: nameNorm, name, code: code || null, alt_codes: [] })
      } else if (code && !driversByName.get(nameNorm).code) {
        driversByName.get(nameNorm).code = code
      }
      driverKey = `name:${nameNorm}`
    } else if (code) {
      if (!driversByCode.has(code)) driversByCode.set(code, { name_norm: null, name: null, code, alt_codes: [] })
      driverKey = `code:${code}`
    }

    // --- expense lines ---
    const fixedLines = []
    let fixedTotal = 0
    for (const [column, catCode] of fixedColumnToCode) {
      const amount = toNumber(r[column])
      if (amount > 0) {
        fixedLines.push({
          expense_category_id: codeToCategoryId.get(catCode) ?? null,
          amount: Math.round(amount * 100) / 100,
          source_column: column,
          parsed_label: null,
          needs_review: false,
        })
        fixedTotal += amount
      }
    }

    const catchLines = []
    let catchTotal = 0
    for (const rec of catchByRowIndex.get(idx) || []) {
      const needsReview = rec.status !== 'exact'
      const splits = needsReview ? expenseOverridesMap.get(`${gkey}|${rec.col}`) : null
      // Apply a durable split only when it still adds up to the booked amount — the
      // sheet may have changed since the treatment. Otherwise fall back to the
      // parser's line and warn, so the wizard's total guard stays meaningful.
      const splitSum = splits ? round2(splits.reduce((a, s) => a + s.amount, 0)) : 0
      const applySplit = splits && Math.abs(splitSum - rec.booked) < 0.01
      if (applySplit) {
        for (const s of splits) {
          catchLines.push({
            expense_category_id: codeToCategoryId.get(s.code) ?? null,
            amount: round2(s.amount),
            source_column: rec.col,
            parsed_label: null,
            needs_review: false,
          })
          catchTotal += s.amount
        }
        continue
      }
      if (splits && !applySplit) {
        warnings.push({ type: 'expense-split-mismatch', om, date, column: rec.col, booked: rec.booked, split: splitSum })
      }
      for (const [catCode, amount, label] of linesFor(rec)) {
        const code = categoryCodeFor(catCode)
        catchLines.push({
          expense_category_id: codeToCategoryId.get(code) ?? null,
          amount,
          source_column: rec.col,
          parsed_label: label,
          needs_review: needsReview,
        })
        catchTotal += amount
      }
    }

    bump(bucket, fixedTotal + catchTotal)

    perRow.push({
      gkey,
      line,
      rkey,
      bucket,
      vehicle_id,
      ledger_plate_norm,
      ledger_code: ledgerCode,
      vehicle_type_raw: clean(r['Type Véhicule']),
      vehicle_label: !plateNorm ? clean(r['Type Véhicule']) || 'Inconnu' : null,
      driverKey,
      driver_code: code,
      driver_name: name,
      bordereau: clean(r['N° bordoreau']),
      description: clean(r.Description),
      observation: clean(r.Observation),
      nature_de_charge: clean(r['Nature de Charge']),
      distance: toNumber(r.Distance) || null,
      duree: toNumber(r.Durée) || null,
      fixedLines,
      catchLines,
    })
  })

  // A code can be claimed by a named driver and (mistakenly) by a nameless row.
  // Keep the named one and drop the code-only duplicate so `drivers.code` stays
  // unique; the nameless row's `code:<x>` key still resolves (see runLedgerImport).
  for (const d of driversByName.values()) {
    if (d.code && driversByCode.has(d.code)) driversByCode.delete(d.code)
  }

  // --- totals for the wizard's invariant guard ---
  let fixedTotal = 0
  let fixedLines = 0
  let catchTotal = 0
  let catchLines = 0
  let needsReviewAmount = 0
  let needsReviewLines = 0
  let grandTotal = 0
  for (const row of perRow) {
    for (const l of row.fixedLines) { fixedTotal += l.amount; fixedLines += 1; grandTotal += l.amount }
    for (const l of row.catchLines) {
      catchTotal += l.amount
      catchLines += 1
      grandTotal += l.amount
      if (l.needs_review) { needsReviewAmount += l.amount; needsReviewLines += 1 }
    }
  }

  // Sum of the raw 8 expense columns over the same rows (what the sheet says).
  let sheetTotal = 0
  let sommeTotal = 0
  for (const r of rows) {
    sheetTotal += ['Auto route', 'Hotel', 'frais de route', 'Gardinnage', 'Divers', 'Procès', 'GASOIL', 'DÉPLACEMENT COMPLEMENTAIRE']
      .reduce((a, c) => a + toNumber(r[c]), 0)
    // The sheet's own computed SUM(OM) column. Its grand total should match
    // sheetTotal; a delta means the sheet has a malformed cell (e.g. `16/,20`),
    // which the wizard surfaces but still imports from the raw columns.
    sommeTotal += toNumber(r['Somme des OM'])
  }

  // --- safety guard: every line must be writable as-is (plan Task 4.7) ---
  const problems = []
  for (const row of perRow) {
    for (const l of [...row.fixedLines, ...row.catchLines]) {
      if (l.expense_category_id == null) {
        problems.push({ type: 'missing-category', om: row.gkey, source_column: l.source_column })
      }
      if (!(l.amount > 0)) {
        problems.push({ type: 'non-positive-amount', om: row.gkey, source_column: l.source_column, amount: l.amount })
      }
    }
  }
  if (Math.abs(grandTotal - (fixedTotal + catchTotal)) >= 0.005) {
    problems.push({ type: 'total-mismatch', grandTotal, fixedTotal, catchTotal })
  }
  if (missionsByKey.size === 0) problems.push({ type: 'no-missions' })

  return {
    missions: [...missionsByKey.values()],
    ledgerVehicles: [...ledgerByPlate.values()],
    drivers: [...driversByName.values(), ...driversByCode.values()],
    perRow,
    catchRecords,
    buckets,
    warnings,
    problems,
    totals: {
      rows: rows.length,
      missions: missionsByKey.size,
      missionVehicles: perRow.length,
      ledgerVehicles: ledgerByPlate.size,
      drivers: driversByName.size + driversByCode.size,
      fixedLines,
      catchLines,
      expenseLines: fixedLines + catchLines,
      fixedTotal: Math.round(fixedTotal * 100) / 100,
      catchTotal: Math.round(catchTotal * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      sheetTotal: Math.round(sheetTotal * 100) / 100,
      sommeTotal: Math.round(sommeTotal * 100) / 100,
      sommeDelta: Math.round((sheetTotal - sommeTotal) * 100) / 100,
      needsReviewLines,
      needsReviewAmount: Math.round(needsReviewAmount * 100) / 100,
    },
  }
}
