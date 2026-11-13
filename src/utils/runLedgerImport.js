// Runs the ledger import against the DB, in batches, reporting progress.
//
// Order matters: mission_vehicles reference drivers / ledger_vehicles / vehicles,
// and mission_expenses reference mission_vehicles. Missions are replaced wholesale
// (source='google_2025') so a re-import is idempotent; drivers and ledger_vehicles
// are upserted so their ids stay stable.
// The real API is loaded lazily so the orchestrator can be unit-tested with an
// injected fake (and so importing this module never touches the Supabase client).
async function loadApi() {
  const mod = await import('../services/api.js')
  return {
    driversApi: mod.driversApi,
    ledgerVehiclesApi: mod.ledgerVehiclesApi,
    missionsApi: mod.missionsApi,
  }
}

const CHUNK = 500

// A whole import is dozens of sequential requests. Any single transient failure
// (dropped connection, suspended tab, gateway 502/503/504, auth refresh blip)
// aborts the run and leaves a half-imported ledger behind — which is exactly what
// we saw: drivers + ledger written, then the run died after the first mission
// chunk. Because the run is idempotent (drivers/ledger_vehicles are upserted and
// ledger missions are deleted then re-inserted from the same source), the safest
// recovery is to redo the whole run from the top rather than resume mid-stream.
const MAX_ATTEMPTS = 3

const RETRYABLE =
  /failed to fetch|network ?error|load failed|network request failed|fetch failed|timeout|timed out|econnreset|econnrefused|socket hang up|connection (closed|reset)|502|503|504|temporar|rate limit|too many requests/i

// A deterministic failure (constraint violation, RLS denial, bad payload) carries
// a SQLSTATE (e.g. 23505) or PostgREST (PGRSTxxx) code and must not be retried.
// Network and auth-refresh blips are worth another attempt.
function isTransient(err) {
  if (!err) return false
  const code = err.code ? String(err.code) : ''
  if (/^[0-9A-Z]{5}$/.test(code) || /^PGRST\d+$/.test(code)) return false
  if (RETRYABLE.test(String(err.message || err))) return true
  return !code
}

export function describeError(err) {
  if (!err) return ''
  return err.message || err.details || err.hint || String(err)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function runOnce(built, { onProgress, api } = {}) {
  const { driversApi, ledgerVehiclesApi, missionsApi } = api || (await loadApi())
  const report = {
    drivers: 0,
    ledgerVehicles: 0,
    missions: 0,
    missionVehicles: 0,
    expenses: 0,
    warnings: [],
  }

  const named = built.drivers.filter((d) => d.name_norm)
  const codeOnly = built.drivers.filter((d) => !d.name_norm && d.code)
  const expenseRows = built.perRow.reduce((a, r) => a + r.fixedLines.length + r.catchLines.length, 0)
  const total =
    named.length + codeOnly.length + built.ledgerVehicles.length +
    built.missions.length + built.perRow.length + expenseRows

  let done = 0
  let step = 'drivers'
  const tick = (n = 1) => {
    done += n
    if (onProgress) onProgress({ done, total, step })
  }

  // 1) drivers ---------------------------------------------------------
  step = 'drivers'
  const driverIdByName = new Map()
  const driverIdByCode = new Map()
  for (const batch of chunk(named, CHUNK)) {
    const rows = await driversApi.upsertBatch(
      batch.map((d) => ({ name_norm: d.name_norm, name: d.name, code: d.code || null, alt_codes: d.alt_codes || [] })),
      'name_norm'
    )
    for (const r of rows) {
      if (r.name_norm) driverIdByName.set(r.name_norm, r.id)
      // A named driver's code is also a valid lookup key: nameless rows sharing
      // that code resolve to this driver instead of a duplicate row.
      if (r.code) driverIdByCode.set(r.code, r.id)
    }
    report.drivers += rows.length
    tick(batch.length)
  }
  for (const batch of chunk(codeOnly, CHUNK)) {
    const rows = await driversApi.upsertBatch(
      batch.map((d) => ({ name_norm: null, name: null, code: d.code, alt_codes: d.alt_codes || [] })),
      'code'
    )
    for (const r of rows) if (r.code) driverIdByCode.set(r.code, r.id)
    report.drivers += rows.length
    tick(batch.length)
  }

  // 2) ledger vehicles -------------------------------------------------
  step = 'ledger-vehicles'
  const ledgerIdByPlate = new Map()
  for (const batch of chunk(built.ledgerVehicles, CHUNK)) {
    const rows = await ledgerVehiclesApi.upsertBatch(
      batch.map((v) => ({ plate_norm: v.plate_norm, plate_raw: v.plate_raw }))
    )
    for (const r of rows) ledgerIdByPlate.set(r.plate_norm, r.id)
    report.ledgerVehicles += rows.length
    tick(batch.length)
  }

  // 3) missions (replace) ---------------------------------------------
  step = 'missions'
  await missionsApi.deleteLedgerMissions()
  const missionIdByKey = new Map()
  for (const batch of chunk(built.missions, CHUNK)) {
    const rows = await missionsApi.insertBatch(
      batch.map((m) => ({
        om: m.om,
        date_depart: m.date_depart,
        depart: m.depart,
        destination: m.destination,
        a_travers: m.a_travers,
        date_arriver: m.date_arriver,
        date_reglement: m.date_reglement,
        gendarmerie_required: !!m.gendarmerie_required,
        source: 'google_2025',
      }))
    )
    for (const r of rows) missionIdByKey.set(`${r.om}|${r.date_depart}`, r.id)
    report.missions += rows.length
    tick(batch.length)
  }

  // 4) mission vehicles ------------------------------------------------
  step = 'mission-vehicles'
  const mvIds = new Array(built.perRow.length).fill(null)
  const mvRows = built.perRow.map((r) => {
    const mission_id = missionIdByKey.get(r.gkey) ?? null
    if (mission_id == null) report.warnings.push({ type: 'orphan-row', gkey: r.gkey })
    let driver_id = null
    if (r.driverKey) {
      const sep = r.driverKey.indexOf(':')
      const kind = r.driverKey.slice(0, sep)
      const val = r.driverKey.slice(sep + 1)
      driver_id = kind === 'name' ? driverIdByName.get(val) ?? null : driverIdByCode.get(val) ?? null
    }
    return {
      mission_id,
      line_no: r.line ?? null,
      vehicle_id: r.vehicle_id ?? null,
      ledger_vehicle_id: r.ledger_plate_norm ? ledgerIdByPlate.get(r.ledger_plate_norm) ?? null : null,
      vehicle_type_raw: r.vehicle_type_raw,
      vehicle_label: r.vehicle_label,
      ledger_code: r.ledger_code,
      driver_id,
      driver_code: r.driver_code,
      driver_name: r.driver_name,
      bordereau: r.bordereau,
      description: r.description,
      observation: r.observation,
      nature_de_charge: r.nature_de_charge,
      distance: r.distance,
      duree: r.duree,
    }
  })

  // Insert sequentially so the returned ids line up with perRow order.
  let mvIndex = 0
  for (const batch of chunk(mvRows, CHUNK)) {
    const inserted = await missionsApi.insertVehicles(batch)
    inserted.forEach((row, i) => { mvIds[mvIndex + i] = row.id })
    mvIndex += batch.length
    report.missionVehicles += inserted.length
    tick(batch.length)
  }

  // 5) mission expenses ------------------------------------------------
  step = 'expenses'
  const expenses = []
  built.perRow.forEach((r, i) => {
    const mvId = mvIds[i]
    if (mvId == null) return
    for (const line of [...r.fixedLines, ...r.catchLines]) {
      if (line.expense_category_id == null) {
        report.warnings.push({ type: 'missing-category', source_column: line.source_column })
        continue
      }
      expenses.push({
        mission_vehicle_id: mvId,
        expense_category_id: line.expense_category_id,
        amount: line.amount,
        source_column: line.source_column,
        parsed_label: line.parsed_label,
        needs_review: line.needs_review,
      })
    }
  })
  for (const batch of chunk(expenses, CHUNK)) {
    report.expenses += await missionsApi.insertExpenses(batch)
    tick(batch.length)
  }

  return report
}

export async function runLedgerImport(built, options = {}) {
  const { onProgress } = options
  let lastErr
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await runOnce(built, options)
    } catch (err) {
      lastErr = err
      if (attempt >= MAX_ATTEMPTS || !isTransient(err)) throw err
      console.warn(
        `Ledger import attempt ${attempt}/${MAX_ATTEMPTS} failed (${describeError(err)}); retrying from scratch…`
      )
      if (onProgress) onProgress({ done: 0, total: 0, step: 'retry', attempt: attempt + 1 })
    }
  }
  throw lastErr
}
