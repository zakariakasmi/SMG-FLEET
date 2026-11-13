import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Plus,
  Trash01,
  Route as RouteIcon,
  AlertTriangle,
  HelpCircle,
  XClose,
} from '@untitledui/icons'
import {
  missionsApi,
  vehiclesApi,
  ledgerVehiclesApi,
  driversApi,
  expenseCategoriesApi,
  categoriesApi,
} from '../../services/api'
import { missionVehicleLines, lineField } from '../../utils/missions'
import { useToast } from '../../context/ToastContext'
import { useUnsaved } from '../../components/ui/UnsavedChangesGuard'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import AutocompleteInput from '../../components/ui/AutocompleteInput'
import { Checkbox } from '../../components/ui-shadcn/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui-shadcn/tooltip'
import { PageSpinner } from '../../components/ui/Spinner'
import ErrorState from '../../components/ui/ErrorState'

const SF = { strokeWidth: 1.75, fill: 'none' }

const money2 = (n) =>
  (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Stable client-side keys so add/remove of repeatable rows keeps React state and
// focus aligned. They never reach the API.
let uidSeq = 0
const uid = () => `k${++uidSeq}`

const toDateInput = (v) => (v ? String(v).slice(0, 10) : '')

// Duration is derived from the mission dates, exactly like the imported ledger:
// `duree` = whole days between departure and arrival (null when either is unset).
function computeDuree(depart, arriver) {
  if (!depart || !arriver) return null
  const a = Date.parse(depart)
  const b = Date.parse(arriver)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86400000)
}

// Nature of charge is a boolean in the UI (NORMAL / HORS GABARIT) matching the
// two values already used across the imported ledger.
const NATURE_NORMAL = 'NORMAL'
const NATURE_HORS_GABARIT = 'HORS GABARIT'

// Description and nature of charge live on mission_vehicles, but they are
// mission-wide values (every row of a mission carries the same one in the
// ledger), so they are edited once in the mission section and mirrored onto
// each vehicle row on save — no schema change needed.

// One vehicle line can be driven by several people (a long haul with a relief
// driver); each driver is stored separately, split back into one mission_vehicles
// row per driver on save — the same shape the imported ledger uses.
const emptyDriver = ({ driver_id = '', driver_name = '', label = '' } = {}) => ({
  key: uid(),
  driver_id: driver_id ? String(driver_id) : '',
  driver_name: driver_name || '',
  label: label || '',
})

const emptyVehicle = () => ({
  key: uid(),
  vehicle_search: '',
  vehicle_id: '',
  ledger_vehicle_id: '',
  vehicle_label: '',
  driver_search: '', // draft text in the "add a driver" input
  drivers: [], // one entry per driver attached to this vehicle line
  vehicle_type_raw: '',
  distance: '',
  bordereau: '',
  observation: '',
})

// An expense is booked on a *seat*: one driver's slot on a vehicle line (or the
// vehicle itself when the ledger recorded no driver for it). One vehicle driven
// by two people is two seats, so a hotel room each goes on both seats while a
// tank of fuel can go on the main driver alone. An expense booked on several
// seats is split equally between them. Seat key = `<vehicle line>|<driver chip>`.
const seatKey = (lineKey, driverKey) => `${lineKey}|${driverKey || ''}`

// Every seat a vehicle line offers: one per driver, or the line itself when it
// has none.
const lineSeatKeys = (mv) =>
  mv.drivers?.length ? mv.drivers.map((d) => seatKey(mv.key, d.key)) : [seatKey(mv.key, '')]

const emptyExpense = (seatKeys = []) => ({
  key: uid(),
  seatKeys,
  expense_category_id: '',
  amount: '',
})

// Split an amount equally between `count` shares, in cents so the shares always
// add back up to the entered total (the leftover cent goes to the first shares).
const splitAmount = (amount, count) => {
  if (count <= 0) return []
  const cents = Math.round((Number(amount) || 0) * 100)
  const base = Math.floor(cents / count)
  const remainder = cents - base * count
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100)
}

const emptyMission = () => {
  const v = emptyVehicle()
  return {
    om: '',
    date_depart: '',
    depart: '',
    destination: '',
    a_travers: '',
    date_arriver: '',
    date_reglement: '',
    gendarmerie_required: false,
    description: '',
    nature_de_charge: NATURE_NORMAL,
    mission_vehicles: [v],
    expenses: [emptyExpense([seatKey(v.key, '')])],
  }
}

// DB mission (from missionsApi.get) → form model. Rows are grouped into vehicle
// lines (one vehicle, possibly several drivers); existing expenses are flattened
// out of their vehicles into the top-level list, tagged with the line's key.
function missionToForm(m) {
  const rows = m.mission_vehicles || []

  const driverOf = (mv) => ({
    driver_id: mv.driver_id ? String(mv.driver_id) : '',
    driver_name: mv.driver_name || '',
    label: mv.driver?.name || mv.driver_name || mv.driver?.code || mv.driver_code || '',
  })

  const lines = missionVehicleLines(m)

  // One form line per vehicle, with every driver of the group as a chip. Rows
  // the ledger split by driver collapse here, and split back out on save.
  // `seatOfRow` remembers which seat each DB row is, so an expense can be put
  // back on the exact driver's row it came from.
  const seatOfRow = new Map()
  const vehicles = lines.map((line) => {
    const mv = line.rows[0]
    const lineKey = uid()
    const search = mv.vehicle
      ? mv.vehicle.registration_plate || mv.vehicle.code || ''
      : mv.ledger_vehicle
        ? mv.ledger_vehicle.plate_norm || mv.ledger_vehicle.plate_raw || ''
        : mv.vehicle_label || ''
    const drivers = []
    for (const r of line.rows) {
      const d = driverOf(r)
      if (d.driver_id || d.driver_name || d.label) {
        const chip = emptyDriver(d)
        drivers.push(chip)
        seatOfRow.set(r.id, seatKey(lineKey, chip.key))
      } else {
        // No driver on this row: the seat is the vehicle itself.
        seatOfRow.set(r.id, seatKey(lineKey, ''))
      }
    }
    return {
      key: lineKey,
      dbId: mv.id,
      vehicle_search: search,
      vehicle_id: mv.vehicle_id ? String(mv.vehicle_id) : '',
      ledger_vehicle_id: mv.ledger_vehicle_id ? String(mv.ledger_vehicle_id) : '',
      vehicle_label: mv.vehicle_label || '',
      driver_search: '',
      drivers,
      // Type/observation are often written on only one row of the group: merge.
      vehicle_type_raw: lineField(line, (r) => r.vehicle_type_raw) || '',
      distance: mv.distance ?? '',
      bordereau: mv.bordereau || '',
      observation: lineField(line, (r) => r.observation) || '',
    }
  })

  // Mission-level values read back from the vehicle rows: the first non-empty
  // description, and "hors gabarit" if any row says so (they are uniform across
  // a mission in practice — verified against the whole ledger).
  const description = rows.map((r) => (r.description || '').trim()).find(Boolean) || ''
  const nature_de_charge = rows.some((r) => r.nature_de_charge === NATURE_HORS_GABARIT)
    ? NATURE_HORS_GABARIT
    : NATURE_NORMAL

  // Each expense keeps the seat (driver slot) of the row it was stored on, so a
  // mission with two drivers reopens with each one's own expenses.
  const expenses = []
  for (const mv of m.mission_vehicles || []) {
    for (const e of mv.mission_expenses || []) {
      const seat = seatOfRow.get(mv.id)
      expenses.push({
        key: uid(),
        seatKeys: seat ? [seat] : [],
        expense_category_id: e.expense_category?.id ? String(e.expense_category.id) : '',
        amount: e.amount ?? '',
      })
    }
  }

  return {
    om: m.om || '',
    date_depart: toDateInput(m.date_depart),
    depart: m.depart || '',
    destination: m.destination || '',
    a_travers: m.a_travers || '',
    date_arriver: toDateInput(m.date_arriver),
    date_reglement: toDateInput(m.date_reglement),
    gendarmerie_required: !!m.gendarmerie_required,
    description,
    nature_de_charge,
    mission_vehicles: vehicles,
    expenses: expenses.length
      ? expenses
      : [emptyExpense(vehicles[0] ? [lineSeatKeys(vehicles[0])[0]] : [])],
  }
}

// Expand the form's vehicle lines into one `mission_vehicles` row per driver
// (the API's unit), put each expense on the driver's row it is booked on, and
// stamp the computed duration. This is the shape missionsApi.create/update take.
function toPayload(form) {
  const duree = computeDuree(form.date_depart, form.date_arriver)

  const rows = form.mission_vehicles.flatMap((mv) => {
    const { drivers = [], driver_search, ...base } = mv
    const list = drivers.length ? drivers : [null]
    return list.map((d) => ({
      seat: seatKey(mv.key, d?.key || ''),
      row: {
        ...base,
        // Mission-level fields, mirrored onto every vehicle row so the child rows
        // stay the only place this data lives (same shape the ledger stores).
        description: form.description,
        nature_de_charge: form.nature_de_charge,
        duree: duree ?? '',
        driver_id: d?.driver_id || '',
        driver_name: d?.driver_name || '',
        expenses: [],
      },
    }))
  })
  const bySeat = new Map(rows.map((r) => [r.seat, r.row]))

  for (const e of form.expenses) {
    const hasCat = !!e.expense_category_id
    const hasAmt = String(e.amount).trim() !== ''
    if (!hasCat && !hasAmt) continue // empty row, ignored
    // An expense booked on several seats is split equally between them, so each
    // driver's own total is right and the shares add back up to the amount that
    // was entered. A stale seat (its driver was removed) falls back to the first
    // seat of the same vehicle line.
    const targets = (e.seatKeys || []).filter((k) => bySeat.has(k))
    const keys = targets.length ? targets : [fallbackSeat(e.seatKeys, rows)].filter(Boolean)
    const shares = splitAmount(e.amount, keys.length)
    keys.forEach((k, i) =>
      bySeat.get(k)?.expenses.push({ expense_category_id: e.expense_category_id, amount: shares[i] })
    )
  }

  return { ...form, mission_vehicles: rows.map((r) => r.row) }
}

// First seat of the vehicle line a stale seat belonged to (seat keys are
// `<line>|<driver>`), else the very first seat of the mission.
function fallbackSeat(seatKeys, rows) {
  for (const sk of seatKeys || []) {
    const lineKey = String(sk).split('|')[0]
    const hit = rows.find((r) => r.seat.startsWith(`${lineKey}|`))
    if (hit) return hit.seat
  }
  return rows[0]?.seat
}

function validate(form, t) {
  const errors = {}
  if (!form.om.trim()) errors.om = t('missions.formRequiredField')
  if (!form.date_depart) errors.date_depart = t('missions.formRequiredField')
  if (!form.mission_vehicles.length) errors.vehicles = t('missions.formNeedOneVehicle')

  form.mission_vehicles.forEach((mv, i) => {
    if (!mv.vehicle_id && !mv.ledger_vehicle_id && !(mv.vehicle_label || '').trim()) {
      errors[`v${i}.vehicle`] = t('missions.formNeedVehicle')
    }
  })

  form.expenses.forEach((e, j) => {
    const hasCat = !!e.expense_category_id
    const hasAmt = String(e.amount).trim() !== ''
    if (!hasCat && !hasAmt) return // empty line, ignored on save
    if (!hasCat) errors[`e${j}.category`] = t('missions.formNeedExpenseCategory')
    if (!hasAmt || !(Number(e.amount) > 0)) errors[`e${j}.amount`] = t('missions.formNeedExpenseAmount')
  })

  return errors
}

export default function MissionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { setDirty, markSaved, showGuard } = useUnsaved()

  const isEdit = !!id

  const [form, setForm] = useState(emptyMission)
  const [errors, setErrors] = useState({})
  const [duplicateId, setDuplicateId] = useState(null)
  const [source, setSource] = useState('manual')
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const [vehiclesRaw, setVehiclesRaw] = useState([])
  const [ledgerRaw, setLedgerRaw] = useState([])
  const [driversRaw, setDriversRaw] = useState([])
  const [categoryOptions, setCategoryOptions] = useState([])
  const [typeOptions, setTypeOptions] = useState([])
  const [optionsError, setOptionsError] = useState(false)

  useEffect(() => {
    setDirty(isDirty)
  }, [isDirty, setDirty])

  // Reference data for the searchable inputs. A failure here leaves the inputs
  // empty (everything degrades to free text) and is surfaced quietly.
  useEffect(() => {
    let active = true
    Promise.all([
      vehiclesApi.list(),
      ledgerVehiclesApi.list(),
      driversApi.list(),
      expenseCategoriesApi.list(),
      categoriesApi.list(),
    ])
      .then(([vehicles, ledger, drivers, cats, vehicleCategories]) => {
        if (!active) return
        setVehiclesRaw(vehicles || [])
        setLedgerRaw(ledger || [])
        setDriversRaw(drivers || [])
        setCategoryOptions(
          (cats || []).map((c) => ({ value: String(c.id), label: c.name_fr || c.code }))
        )
        // Vehicle "type" on a mission line is the fleet vehicle's *category*
        // (Porte Chars, Plateaux 12M, …) — the same vocabulary the imported
        // ledger stores in `vehicle_type_raw`.
        setTypeOptions(
          (vehicleCategories || [])
            .map((c) => c.name)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
        )
      })
      .catch((err) => {
        console.error('Error loading mission form options:', err)
        if (active) setOptionsError(true)
      })
    return () => {
      active = false
    }
  }, [])

  // Search indexes for the vehicle / driver autocompletes: the suggestion list
  // plus lookups used to resolve what the user typed back to a real row.
  const ref = useMemo(() => {
    const fleetLabelById = new Map()
    const ledgerLabelById = new Map()
    const fleetByPlate = new Map()
    const fleetByCode = new Map()
    const ledgerByPlate = new Map()
    const fleetCategoryById = new Map()
    const ledgerCategoryById = new Map()
    const vehicleLabels = []
    const vehicleLabelToRef = new Map()

    const pushVehicleLabel = (label, refObj) => {
      if (label && !vehicleLabelToRef.has(label)) {
        vehicleLabelToRef.set(label, refObj)
        vehicleLabels.push(label)
      }
    }

    for (const v of vehiclesRaw) {
      const plate = v.registration_plate || ''
      const code = v.code || ''
      const label = plate ? (code ? `${plate} · ${code}` : plate) : code
      if (label) {
        fleetLabelById.set(String(v.id), label)
        pushVehicleLabel(label, { vehicle_id: String(v.id) })
      }
      if (plate) fleetByPlate.set(plate.toLowerCase(), String(v.id))
      if (code) fleetByCode.set(code.toLowerCase(), String(v.id))
      fleetCategoryById.set(String(v.id), v.category?.name || '')
    }
    for (const v of ledgerRaw) {
      const plate = v.plate_norm || v.plate_raw || ''
      if (plate) {
        ledgerLabelById.set(String(v.id), plate)
        pushVehicleLabel(plate, { ledger_vehicle_id: String(v.id) })
        ledgerByPlate.set(plate.toLowerCase(), String(v.id))
      }
      // A ledger plate may already be linked to a fleet vehicle, from which the
      // vehicle type (category) is inherited.
      ledgerCategoryById.set(
        String(v.id),
        v.vehicle_id ? fleetCategoryById.get(String(v.vehicle_id)) || '' : ''
      )
    }

    const driverLabels = []
    const driverLabelToId = new Map()
    for (const d of driversRaw) {
      const label = d.name || d.code
      if (label && !driverLabelToId.has(label)) {
        driverLabelToId.set(label, String(d.id))
        driverLabels.push(label)
      }
    }

    return {
      fleetLabelById,
      ledgerLabelById,
      fleetByPlate,
      fleetByCode,
      ledgerByPlate,
      fleetCategoryById,
      ledgerCategoryById,
      vehicleLabels,
      vehicleLabelToRef,
      driverLabels,
      driverLabelToId,
    }
  }, [vehiclesRaw, ledgerRaw, driversRaw])

  // Resolve typed text to a vehicle link (fleet by plate/code, then ledger by
  // plate); anything unmatched is kept as free text on vehicle_label.
  const resolveVehicle = (text) => {
    const trimmed = (text || '').trim()
    if (!trimmed) return { vehicle_id: '', ledger_vehicle_id: '', vehicle_label: '' }
    const hit = ref.vehicleLabelToRef.get(trimmed)
    if (hit) return { vehicle_id: hit.vehicle_id || '', ledger_vehicle_id: hit.ledger_vehicle_id || '', vehicle_label: '' }
    const low = trimmed.toLowerCase()
    const fleetId = ref.fleetByPlate.get(low) || ref.fleetByCode.get(low)
    if (fleetId) return { vehicle_id: fleetId, ledger_vehicle_id: '', vehicle_label: '' }
    const ledgerId = ref.ledgerByPlate.get(low)
    if (ledgerId) return { vehicle_id: '', ledger_vehicle_id: ledgerId, vehicle_label: '' }
    return { vehicle_id: '', ledger_vehicle_id: '', vehicle_label: trimmed }
  }

  // The vehicle type (category) that a given autocomplete text maps to, pulled
  // from the fleet/ledger row's linked vehicle. '' when nothing is known.
  const vehicleTypeFor = (text) => {
    const trimmed = (text || '').trim()
    if (!trimmed) return ''
    const hit = ref.vehicleLabelToRef.get(trimmed)
    if (hit?.vehicle_id) return ref.fleetCategoryById.get(hit.vehicle_id) || ''
    if (hit?.ledger_vehicle_id) return ref.ledgerCategoryById.get(hit.ledger_vehicle_id) || ''
    const low = trimmed.toLowerCase()
    const fleetId = ref.fleetByPlate.get(low) || ref.fleetByCode.get(low)
    if (fleetId) return ref.fleetCategoryById.get(fleetId) || ''
    const ledgerId = ref.ledgerByPlate.get(low)
    if (ledgerId) return ref.ledgerCategoryById.get(ledgerId) || ''
    return ''
  }

  // Resolve a driver name/code. Only auto-link when it matches exactly one
  // driver — duplicate names stay as free text so a wrong link is never written.
  const resolveDriver = (text) => {
    const trimmed = (text || '').trim()
    if (!trimmed) return { driver_id: '', driver_name: '' }
    const low = trimmed.toLowerCase()
    const matches = driversRaw.filter(
      (d) => (d.name || '').toLowerCase() === low || (d.code || '').toLowerCase() === low
    )
    if (matches.length === 1) return { driver_id: String(matches[0].id), driver_name: '' }
    return { driver_id: '', driver_name: trimmed }
  }

  useEffect(() => {
    if (!isEdit) return
    let active = true
    setLoading(true)
    setLoadError(false)
    missionsApi
      .get(id)
      .then((m) => {
        if (!active) return
        if (!m) {
          setLoadError(true)
          return
        }
        setForm(missionToForm(m))
        setSource(m.source || 'manual')
      })
      .catch((err) => {
        console.error('Error loading mission:', err)
        if (active) setLoadError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, isEdit, retryKey])

  const updateMission = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setIsDirty(true)
  }

  const updateVehicle = (vi, patch) => {
    setForm((f) => ({
      ...f,
      mission_vehicles: f.mission_vehicles.map((mv, i) => (i === vi ? { ...mv, ...patch } : mv)),
    }))
    setIsDirty(true)
  }

  const addVehicle = () => {
    setForm((f) => ({ ...f, mission_vehicles: [...f.mission_vehicles, emptyVehicle()] }))
    setIsDirty(true)
  }

  // Drivers are a list per vehicle line: a chip per person, and each chip becomes
  // one mission_vehicles row on save. The autocomplete only exposes raw text, so
  // adding happens through the "Add" button (or Enter), and a draft left in the
  // input is committed the same way before validation/save.
  const driverKey = (d) => (d.driver_id || d.driver_name || d.label || '').toLowerCase()
  const commitDriverDraft = (mv) => {
    const text = (mv.driver_search || '').trim()
    if (!text) return mv
    const next = { key: uid(), ...resolveDriver(text), label: text }
    const duplicate = mv.drivers.some((d) => driverKey(d) === driverKey(next))
    return { ...mv, driver_search: '', drivers: duplicate ? mv.drivers : [...mv.drivers, next] }
  }

  const addDriver = (vi) => {
    setForm((f) => ({
      ...f,
      mission_vehicles: f.mission_vehicles.map((mv, i) => (i === vi ? commitDriverDraft(mv) : mv)),
    }))
    setIsDirty(true)
  }

  // Removing a driver removes his seat from every expense that was booked on it,
  // falling back to the first remaining seat of the same vehicle so no amount is
  // silently lost.
  const removeDriver = (vi, di) => {
    setForm((f) => {
      const mv = f.mission_vehicles[vi]
      const driver = mv.drivers[di]
      const removedSeat = seatKey(mv.key, driver?.key || '')
      const drivers = mv.drivers.filter((_, j) => j !== di)
      const remainingSeats = drivers.length
        ? drivers.map((d) => seatKey(mv.key, d.key))
        : [seatKey(mv.key, '')]
      const expenses = f.expenses.map((e) => {
        if (!(e.seatKeys || []).includes(removedSeat)) return e
        const rest = e.seatKeys.filter((k) => k !== removedSeat)
        return { ...e, seatKeys: rest.length ? rest : [remainingSeats[0]] }
      })
      return {
        ...f,
        mission_vehicles: f.mission_vehicles.map((x, i) => (i === vi ? { ...x, drivers } : x)),
        expenses,
      }
    })
    setIsDirty(true)
  }

  const withDraftDriversCommitted = (f) => ({
    ...f,
    mission_vehicles: f.mission_vehicles.map(commitDriverDraft),
  })

  const removeVehicle = (vi) => {
    setForm((f) => {
      const removed = f.mission_vehicles[vi]
      const remaining = f.mission_vehicles.filter((_, i) => i !== vi)
      const removedSeats = new Set(lineSeatKeys(removed))
      const fallback = remaining.length ? lineSeatKeys(remaining[0])[0] : ''
      const expenses = f.expenses.map((e) => {
        const rest = (e.seatKeys || []).filter((k) => !removedSeats.has(k))
        return { ...e, seatKeys: rest.length || !fallback ? rest : [fallback] }
      })
      return { ...f, mission_vehicles: remaining, expenses }
    })
    setIsDirty(true)
  }

  const updateExpense = (ei, patch) => {
    setForm((f) => ({
      ...f,
      expenses: f.expenses.map((e, j) => (j === ei ? { ...e, ...patch } : e)),
    }))
    setIsDirty(true)
  }

  // Toggle one seat (driver slot) on/off an expense's target list. Deselecting
  // the last one is a no-op: an expense always belongs to someone.
  const toggleExpenseSeat = (ei, seat) => {
    setForm((f) => ({
      ...f,
      expenses: f.expenses.map((e, j) => {
        if (j !== ei) return e
        const current = e.seatKeys || []
        if (current.includes(seat)) {
          const rest = current.filter((k) => k !== seat)
          return { ...e, seatKeys: rest.length ? rest : current }
        }
        return { ...e, seatKeys: [...current, seat] }
      }),
    }))
    setIsDirty(true)
  }

  const addExpense = () => {
    setForm((f) => ({
      ...f,
      expenses: [
        ...f.expenses,
        emptyExpense(f.mission_vehicles[0] ? [lineSeatKeys(f.mission_vehicles[0])[0]] : []),
      ],
    }))
    setIsDirty(true)
  }

  const removeExpense = (ei) => {
    setForm((f) => ({ ...f, expenses: f.expenses.filter((_, j) => j !== ei) }))
    setIsDirty(true)
  }

  const total = useMemo(
    () => form.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [form.expenses]
  )

  const duree = useMemo(
    () => computeDuree(form.date_depart, form.date_arriver),
    [form.date_depart, form.date_arriver]
  )

  // Options for the vehicle-type select: the fleet categories, plus the row's
  // current value when it isn't one of them (an imported odd spelling), so
  // editing never silently blanks it.
  const vehicleTypeOptions = (current) => {
    const opts = typeOptions.map((name) => ({ value: name, label: name }))
    if (current && !opts.some((o) => o.value === current)) {
      return [...opts, { value: current, label: current }]
    }
    return opts
  }

  const vehicleDisplay = (mv, i) => {
    if (mv.vehicle_id) return ref.fleetLabelById.get(String(mv.vehicle_id)) || mv.vehicle_search
    if (mv.ledger_vehicle_id) return ref.ledgerLabelById.get(String(mv.ledger_vehicle_id)) || mv.vehicle_search
    return mv.vehicle_label || mv.vehicle_search || t('missions.formVehicleN', { n: i + 1 })
  }

  // The seats an expense can be booked on: one per driver of each vehicle line,
  // or the vehicle itself when the line has no driver. With a single vehicle the
  // chip is just the driver's name; with several, the vehicle is prefixed so two
  // drivers with the same name stay apart.
  const seatChoices = useMemo(() => {
    const multi = form.mission_vehicles.length > 1
    const out = []
    form.mission_vehicles.forEach((mv, i) => {
      const vlabel = vehicleDisplay(mv, i)
      if (!mv.drivers.length) {
        out.push({ value: seatKey(mv.key, ''), label: multi ? `${vlabel} · ${t('missions.formNoDriver')}` : vlabel })
        return
      }
      for (const d of mv.drivers) {
        const dlabel = d.label || d.driver_name || '-'
        out.push({ value: seatKey(mv.key, d.key), label: multi ? `${vlabel} · ${dlabel}` : dlabel })
      }
    })
    return out
  }, [form.mission_vehicles, ref, t])

  const leave = () => showGuard(() => navigate('/missions'))

  const handleSave = async () => {
    const committed = withDraftDriversCommitted(form)
    const errs = validate(committed, t)
    setErrors(errs)
    setDuplicateId(null)
    if (Object.keys(errs).length) {
      if (committed !== form) setForm(committed)
      return
    }

    const payload = toPayload(committed)
    setSaving(true)
    try {
      if (isEdit) {
        await missionsApi.update(id, payload)
        markSaved()
        setIsDirty(false)
        showToast(t('missions.formSaved'), 'success')
        navigate(`/missions/${id}`)
        return
      }

      const dup = await missionsApi.findByOmDate(payload.om.trim(), payload.date_depart)
      if (dup) {
        setDuplicateId(dup.id)
        setErrors({ om: t('missions.formDuplicate') })
        showToast(t('missions.formDuplicate'), 'error')
        return
      }

      const created = await missionsApi.create(payload)
      markSaved()
      setIsDirty(false)
      showToast(t('missions.formCreated'), 'success')
      navigate(`/missions/${created.id}`)
    } catch (err) {
      console.error('Error saving mission:', err)
      // UNIQUE(om, date_depart) — the pre-check raced or was skipped.
      if (err?.code === '23505' || String(err?.message || '').includes('missions_om_date_depart_key')) {
        setErrors({ om: t('missions.formDuplicate') })
        showToast(t('missions.formDuplicate'), 'error')
      } else {
        showToast(err?.message || t('missions.formSaveFailed'), 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSpinner message={t('common.loading')} />

  if (loadError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/missions')}>
          <ArrowLeft {...SF} className="mr-2 h-4 w-4" />
          {t('missions.backToList')}
        </Button>
        <div className="rounded-md border border-border bg-card p-4">
          <ErrorState
            title={t('missions.formLoadFailed')}
            description={t('ui.errorLoadDesc')}
            onRetry={() => setRetryKey((k) => k + 1)}
            retryText={t('ui.retry')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={leave}>
        <ArrowLeft {...SF} className="mr-2 h-4 w-4" />
        {t('common.back')}
      </Button>

      <Card>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RouteIcon {...SF} className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEdit ? t('missions.editMission') : t('missions.newMission')}
            </h1>
            {isEdit && (
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {source === 'manual' ? t('missions.sourceManual') : t('missions.sourceImported')}
              </p>
            )}
          </div>
        </div>

        {isEdit && source !== 'manual' && (
          <div
            className="mb-6 flex items-start gap-2 rounded-lg border p-3"
            style={{ borderColor: 'hsl(var(--warning))', background: 'hsl(var(--warning) / 0.06)' }}
          >
            <AlertTriangle {...SF} className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
            <p className="text-[13px] text-foreground">{t('missions.importedEditWarning')}</p>
          </div>
        )}

        {/* --- Mission header --- */}
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('missions.formSectionMission')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Input
              label={t('missions.formOm')}
              required
              value={form.om}
              onChange={(e) => updateMission({ om: e.target.value })}
              error={errors.om}
            />
            {duplicateId && (
              <button
                type="button"
                onClick={() => navigate(`/missions/${duplicateId}`)}
                className="mt-1.5 text-[13px] font-semibold text-primary hover:underline"
              >
                {t('missions.formDuplicateOpen')}
              </button>
            )}
          </div>
          <Input
            label={t('missions.formDateDepart')}
            type="date"
            required
            value={form.date_depart}
            onChange={(e) => updateMission({ date_depart: e.target.value })}
            error={errors.date_depart}
          />
          <Input
            label={t('missions.formDepart')}
            value={form.depart}
            onChange={(e) => updateMission({ depart: e.target.value })}
          />
          <Input
            label={t('missions.formDestination')}
            value={form.destination}
            onChange={(e) => updateMission({ destination: e.target.value })}
          />
          <Input
            label={t('missions.formVia')}
            value={form.a_travers}
            onChange={(e) => updateMission({ a_travers: e.target.value })}
          />
          <Input
            label={t('missions.formDateArriver')}
            type="date"
            value={form.date_arriver}
            onChange={(e) => updateMission({ date_arriver: e.target.value })}
          />
          <Input
            label={t('missions.formDateReglement')}
            type="date"
            value={form.date_reglement}
            onChange={(e) => updateMission({ date_reglement: e.target.value })}
          />
          <Input
            label={t('missions.formDuration')}
            value={duree == null ? '' : String(duree)}
            placeholder="—"
            readOnly
            className="bg-muted/40"
          />

          {/* Description + nature are mission-wide (see emptyVehicle), so they
              sit with the mission details rather than on each vehicle row. */}
          <div className="sm:col-span-2">
            <Input
              label={t('missions.formDescription')}
              placeholder={t('missions.formDescriptionPlaceholder')}
              value={form.description}
              onChange={(e) => updateMission({ description: e.target.value })}
            />
          </div>

          <div className="w-full">
            <div className="mb-2 text-[13px] font-medium text-muted-foreground">
              {t('missions.formNature')}
            </div>
            <div className="inline-flex rounded-md border border-border bg-background p-0.5">
              {[
                [NATURE_NORMAL, t('missions.formNatureNormal')],
                [NATURE_HORS_GABARIT, t('missions.formNatureHorsGabarit')],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateMission({ nature_de_charge: val })}
                  className={`rounded px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    form.nature_de_charge === val
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* --- Vehicles --- */}
        <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('missions.formSectionVehicles')}
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label
                htmlFor="mission-escort"
                className="flex cursor-pointer items-center gap-2.5 text-[15px] font-medium text-foreground"
              >
                <Checkbox
                  id="mission-escort"
                  checked={form.gendarmerie_required}
                  onCheckedChange={(v) => updateMission({ gendarmerie_required: !!v })}
                />
                {t('missions.formGendarmerie')}
              </label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={t('missions.formGendarmerieHelp')}
                      className="inline-flex shrink-0 items-center text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('missions.formGendarmerieHelp')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Button variant="secondary" size="sm" onClick={addVehicle}>
              <Plus {...SF} className="mr-1.5 h-4 w-4" />
              {t('missions.formAddVehicle')}
            </Button>
          </div>
        </div>

        {errors.vehicles && (
          <p className="mt-2 text-[13px] font-medium text-destructive">{errors.vehicles}</p>
        )}

        <div className="mt-4 space-y-4">
          {form.mission_vehicles.map((mv, vi) => (
            <div key={mv.key} className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {t('missions.formVehicleN', { n: vi + 1 })}
                </h3>
                {form.mission_vehicles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVehicle(vi)}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-destructive hover:opacity-80"
                  >
                    <Trash01 {...SF} className="h-4 w-4" />
                    {t('missions.formRemoveVehicle')}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-1">
                  <AutocompleteInput
                    label={t('missions.formVehicle')}
                    required
                    options={ref.vehicleLabels}
                    value={mv.vehicle_search}
                    onChange={(val) => {
                      const type = vehicleTypeFor(val)
                      updateVehicle(vi, {
                        vehicle_search: val,
                        ...resolveVehicle(val),
                        ...(type ? { vehicle_type_raw: type } : {}),
                      })
                    }}
                    placeholder={t('missions.formVehiclePlaceholder')}
                    error={errors[`v${vi}.vehicle`]}
                  />
                  {(mv.vehicle_id || mv.ledger_vehicle_id) && (
                    <p className="mt-1 text-[12px] font-medium text-success">
                      {t('missions.formVehicleLinked', { label: vehicleDisplay(mv, vi) })}
                    </p>
                  )}
                  {!mv.vehicle_id && !mv.ledger_vehicle_id && mv.vehicle_search && (
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {t('missions.formVehicleUnknown')}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                    {t('missions.formDrivers')}
                  </label>
                  {mv.drivers.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {mv.drivers.map((d, di) => (
                        <span
                          key={d.key}
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background py-1 pl-2.5 pr-1.5 text-[13px] text-foreground"
                        >
                          <span className="truncate">{d.label || d.driver_name || '-'}</span>
                          <button
                            type="button"
                            onClick={() => removeDriver(vi, di)}
                            aria-label={t('missions.formRemoveDriver')}
                            title={t('missions.formRemoveDriver')}
                            className="inline-flex shrink-0 items-center justify-center rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                          >
                            <XClose {...SF} className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <AutocompleteInput
                        options={ref.driverLabels}
                        value={mv.driver_search}
                        onChange={(val) => updateVehicle(vi, { driver_search: val })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addDriver(vi)
                          }
                        }}
                        placeholder={t('missions.formDriverPlaceholder')}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => addDriver(vi)}
                      disabled={!(mv.driver_search || '').trim()}
                    >
                      <Plus {...SF} className="mr-1 h-4 w-4" />
                      {t('missions.formAddDriver')}
                    </Button>
                  </div>
                  {mv.drivers.length > 1 && (
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {t('missions.formDriverMultiple', { count: mv.drivers.length })}
                    </p>
                  )}
                </div>

                <Select
                  label={t('missions.formVehicleType')}
                  placeholder={t('missions.formVehicleTypePlaceholder')}
                  value={mv.vehicle_type_raw}
                  onChange={(e) => updateVehicle(vi, { vehicle_type_raw: e.target.value })}
                  options={vehicleTypeOptions(mv.vehicle_type_raw)}
                />

                <Input
                  label={t('missions.formDistance')}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={mv.distance}
                  onChange={(e) => updateVehicle(vi, { distance: e.target.value })}
                />
                <Input
                  label={t('missions.formBordereau')}
                  value={mv.bordereau}
                  onChange={(e) => updateVehicle(vi, { bordereau: e.target.value })}
                />
              </div>

              <div className="mt-4">
                <Input
                  label={t('missions.formObservation')}
                  placeholder={t('missions.formObservationPlaceholder')}
                  value={mv.observation}
                  onChange={(e) => updateVehicle(vi, { observation: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>

        {/* --- Expenses (separate from vehicles) --- */}
        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('missions.formSectionExpenses')}
          </h2>
          <Button variant="secondary" size="sm" onClick={addExpense}>
            <Plus {...SF} className="mr-1.5 h-4 w-4" />
            {t('missions.formAddExpense')}
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {form.expenses.map((e, ei) => {
            // A mission with one driver (or none) has a single seat, so the
            // expense obviously belongs to it and the picker stays hidden.
            const targets = seatChoices.length > 1 ? e.seatKeys || [] : []
            const share = targets.length > 1 ? splitAmount(e.amount, targets.length)[0] : 0
            return (
              <div key={e.key}>
                <div className="flex items-start gap-2">
                  {seatChoices.length > 1 && (
                    <div
                      className="w-56 shrink-0 pt-1.5"
                      title={t('missions.formExpenseSeatsHelp')}
                    >
                      <div className="flex flex-wrap gap-1">
                        {seatChoices.map((c) => {
                          const selected = targets.includes(c.value)
                          return (
                            <button
                              key={c.value}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleExpenseSeat(ei, c.value)}
                              className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                                selected
                                  ? 'border-primary bg-primary/10 font-semibold text-primary'
                                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <span className="truncate">{c.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex-1">
                    <Select
                      placeholder={t('missions.formExpenseCategory')}
                      value={e.expense_category_id}
                      onChange={(ev) => updateExpense(ei, { expense_category_id: ev.target.value })}
                      options={categoryOptions}
                      error={errors[`e${ei}.category`]}
                    />
                  </div>
                  <div className="w-40">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder={t('missions.formExpenseAmount')}
                      value={e.amount}
                      onChange={(ev) => updateExpense(ei, { amount: ev.target.value })}
                      error={errors[`e${ei}.amount`]}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExpense(ei)}
                    disabled={form.expenses.length === 1}
                    title={t('missions.formRemove')}
                    className="mt-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    <Trash01 {...SF} className="h-4 w-4" />
                  </button>
                </div>
                {targets.length > 1 && Number(e.amount) > 0 && (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {t('missions.formExpenseShared', {
                      count: targets.length,
                      amount: money2(share),
                    })}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {optionsError && (
          <p className="mt-3 text-[12px] text-muted-foreground">{t('missions.formNoOptions')}</p>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
          <span className="text-[13px] font-medium text-muted-foreground">
            {t('missions.formTotal')}:{' '}
            <span className="text-[15px] font-semibold text-foreground">{money2(total)}</span>
          </span>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={leave}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {isEdit ? t('common.save') : t('missions.createMission')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
