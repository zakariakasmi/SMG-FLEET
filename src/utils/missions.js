// Shared helpers for the read-only Missions module (Plan 3, spec §11).
// `missionsApi.list`/`get` embed mission_vehicles → mission_expenses so the list
// can compute chip/driver/amount client-side without extra queries.

// Vehicle chip fallback order (spec §11): fleet code → ledger plate → raw label.
export function vehicleChip(mv) {
  if (!mv) return { kind: 'none', label: '-' }
  if (mv.vehicle?.code) return { kind: 'fleet', label: mv.vehicle.code }
  if (mv.ledger_vehicle?.plate_norm) return { kind: 'ledger', label: mv.ledger_vehicle.plate_norm }
  if (mv.ledger_code) return { kind: 'ledger', label: mv.ledger_code }
  if (mv.vehicle_label) return { kind: 'unknown', label: mv.vehicle_label }
  return { kind: 'unknown', label: '-' }
}

// A convoy mixes the hauling vehicle (a porte-char or a plateau) with escorts
// (VOITURE/PICKUP ESCORT) and sometimes a light car. The vehicle/driver surfaced
// for a mission is that *main* one, not whichever row happens to come first.
const MAIN_VEHICLE_RE = /porte\s?char|plateau/i
const ESCORT_VEHICLE_RE = /escort/i

export function mainVehicle(mission) {
  const mvs = mission?.mission_vehicles || []
  if (mvs.length === 0) return null
  const typeOf = (mv) => mv.vehicle_type_raw || mv.vehicle_label || ''
  return (
    mvs.find((mv) => MAIN_VEHICLE_RE.test(typeOf(mv))) ||
    mvs.find((mv) => !ESCORT_VEHICLE_RE.test(typeOf(mv))) ||
    mvs[0]
  )
}

function driverLabel(mv) {
  return mv.driver_name || mv.driver?.name || mv.driver_code || mv.driver?.code || ''
}

// The ledger writes "one vehicle driven by several people" as several rows for
// the same vehicle (each row carrying its own expenses). The vehicle — plus the
// trip's distance/bordereau, so two distinct legs of the same truck stay apart —
// is the line's identity. Type and observation are often written on only ONE of
// the rows, so they are not part of the identity: they are merged (see lineField).
function vehicleLineKey(mv) {
  const s = (v) => (v == null ? '' : String(v))
  return [s(mv.vehicle_id), s(mv.ledger_vehicle_id), mv.vehicle_label || '', mv.ledger_code || '', s(mv.distance), s(mv.bordereau)].join('\u0000')
}

// First non-empty value of a per-vehicle field across the rows of a line, so a
// type/observation written on any row still reaches the grouped line.
export function lineField(line, pick) {
  for (const mv of line?.rows || []) {
    const v = pick(mv)
    if (v !== '' && v !== null && v !== undefined) return v
  }
  return ''
}

// Group a mission's rows into vehicle lines. Rows of one line are often not
// adjacent in the ledger (escort, hauling truck, escort…), so grouping is by
// identity; a line keeps the position of its first row.
export function missionVehicleLines(mission) {
  const byKey = new Map()
  const lines = []
  for (const mv of mission?.mission_vehicles || []) {
    const key = vehicleLineKey(mv)
    let line = byKey.get(key)
    if (!line) {
      line = { rows: [] }
      byKey.set(key, line)
      lines.push(line)
    }
    line.rows.push(mv)
  }
  return lines
}

// Distinct driver names of a line, in ledger order.
export function lineDriverLabels(line) {
  const seen = new Set()
  const out = []
  for (const mv of line?.rows || []) {
    const label = driverLabel(mv)
    if (label && !seen.has(label)) {
      seen.add(label)
      out.push(label)
    }
  }
  return out
}

export function missionVehicleChip(mission) {
  const mvs = mission?.mission_vehicles || []
  if (mvs.length === 0) return { kind: 'none', label: '-', extra: 0 }
  const chip = vehicleChip(mainVehicle(mission))
  // Extra vehicles, not extra rows: one truck driven by two people is still one
  // vehicle (see missionVehicleLines).
  return { ...chip, extra: Math.max(0, missionVehicleLines(mission).length - 1) }
}

export function missionAmount(mission) {
  return (mission?.mission_vehicles || []).reduce(
    (total, mv) => total + (mv.mission_expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0),
    0
  )
}

// One mission_vehicles row IS one driver's slot: the ledger writes a row per
// vehicle+driver and keeps that row's own expenses. So "the expenses of a
// driver" is the sum of the rows he owns, not the mission total.
export function missionRowDriver(mv) {
  return driverLabel(mv)
}

export function driverMatchesRow(mv, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return false
  return [mv?.driver_name, mv?.driver_code, mv?.driver?.name, mv?.driver?.code]
    .some((v) => String(v || '').toLowerCase().includes(q))
}

export function driverMissionAmount(mission, query) {
  return (mission?.mission_vehicles || [])
    .filter((mv) => driverMatchesRow(mv, query))
    .reduce(
      (total, mv) => total + (mv.mission_expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0),
      0
    )
}

// The drivers whose own rows matched a driver filter — a per-driver export must
// name that driver alone, not the mission's other drivers.
export function driverMissionLabels(mission, query) {
  const labels = []
  for (const mv of mission?.mission_vehicles || []) {
    if (!driverMatchesRow(mv, query)) continue
    const label = missionRowDriver(mv)
    if (label && !labels.includes(label)) labels.push(label)
  }
  return labels
}

export function missionDriver(mission) {
  const main = mainVehicle(mission)
  if (!main) return '-'
  // The main vehicle's *line*, so a truck with two drivers shows both — the row
  // mainVehicle lands on only ever carries one of them.
  const line = missionVehicleLines(mission).find((l) => l.rows.includes(main))
  const labels = line ? lineDriverLabels(line) : []
  if (labels.length) return labels.join(', ')
  return driverLabel(main) || '-'
}

// Canonical type of the mission's main vehicle: the resolved vehicle category
// (Porte Chars, Plateaux 12M, …), falling back to the raw ledger text for lines
// nobody has mapped yet. See mission_vehicles.category_id.
export function missionVehicleType(mission) {
  const mv = mainVehicle(mission)
  if (!mv) return ''
  return mv.category?.name || mv.vehicle_type_raw || ''
}

// Description lives on every vehicle row but is mission-wide in practice, so the
// first non-empty one is the mission's description.
export function missionDescription(mission) {
  return (mission?.mission_vehicles || []).map((mv) => (mv.description || '').trim()).find(Boolean) || ''
}

export function isUnknownVehicle(mv) {
  return !mv?.vehicle_id && !mv?.ledger_vehicle_id
}

export function missionHasUnknownVehicle(mission) {
  return (mission?.mission_vehicles || []).some(isUnknownVehicle)
}

export function missionHasNeedsReview(mission) {
  return (mission?.mission_vehicles || []).some((mv) =>
    (mv.mission_expenses || []).some((e) => e.needs_review)
  )
}

export function missionNeedsReviewLines(mission) {
  return (mission?.mission_vehicles || []).reduce(
    (acc, mv) => acc.concat((mv.mission_expenses || []).filter((e) => e.needs_review).map((e) => ({ ...e, mv }))),
    []
  )
}

export function missionExpenseLines(mission) {
  return (mission?.mission_vehicles || []).reduce(
    (acc, mv) => acc.concat((mv.mission_expenses || []).map((e) => ({ ...e, mv }))),
    []
  )
}

export function routeLabel(mission) {
  const from = mission?.depart || '-'
  const to = mission?.destination || '-'
  return { from, to, via: mission?.a_travers || null }
}
