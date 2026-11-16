// In-memory mock of the Supabase client used when VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY are not configured (e.g. local preview without a
// remote Supabase project). Mirrors the PostgREST query builder, Auth API,
// and RPCs consumed by src/services/api.js and src/context/AuthContext.jsx.

type Row = Record<string, any>

const SESSION_STORAGE_KEY = 'smg-mock-supabase-session'
const CURRENT_YEAR = new Date().getFullYear()

function deepClone<T>(val: T): T {
  if (val === null || typeof val !== 'object') return val
  if (Array.isArray(val)) return val.map(deepClone) as unknown as T
  const out: Row = {}
  for (const [k, v] of Object.entries(val as Row)) {
    out[k] = deepClone(v)
  }
  return out as T
}

function createInitialDb(): Record<string, Row[]> {
  return {
    users: [
      {
        id: 1,
        auth_id: '00000000-0000-4000-8000-000000000001',
        username: 'admin',
        email: 'admin@smg.local',
        display_name: 'Administrateur',
        role: 'admin',
        permissions: [],
        created_at: '2026-01-01T08:00:00Z',
      },
      {
        id: 2,
        auth_id: '00000000-0000-4000-8000-000000000002',
        username: 'demo',
        email: 'demo@smg-fleet.ma',
        display_name: 'Gestionnaire Flotte',
        role: 'admin',
        permissions: [],
        created_at: '2026-01-02T08:00:00Z',
      },
    ],
    vehicle_categories: [
      { id: 1, name: 'Porte Chars', description: 'Transport engins lourds', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'Plateaux 12M', description: 'Plateaux transport matériaux', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { id: 3, name: 'Bennes', description: 'Camions benne', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { id: 4, name: 'Voitures', description: 'Véhicules légers et escortes', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { id: 5, name: 'Divers', description: 'Autres véhicules', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    ],
    vehicle_types: [
      { id: 1, name: 'Benne', created_at: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'Minibus', created_at: '2026-01-01T00:00:00Z' },
      { id: 3, name: 'Pickup', created_at: '2026-01-01T00:00:00Z' },
      { id: 4, name: 'Tracteur', created_at: '2026-01-01T00:00:00Z' },
      { id: 5, name: 'Malaxeur', created_at: '2026-01-01T00:00:00Z' },
      { id: 6, name: 'Camion plateau', created_at: '2026-01-01T00:00:00Z' },
      { id: 7, name: 'Camion Grue', created_at: '2026-01-01T00:00:00Z' },
      { id: 8, name: 'Camion Benne à ordures', created_at: '2026-01-01T00:00:00Z' },
    ],
    fuel_types: [
      { id: 1, name: 'Diesel', created_at: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'Essence', created_at: '2026-01-01T00:00:00Z' },
    ],
    brands: [
      { id: 1, name: 'MAN', created_at: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'IVECO', created_at: '2026-01-01T00:00:00Z' },
      { id: 3, name: 'SHACMAN', created_at: '2026-01-01T00:00:00Z' },
      { id: 4, name: 'MITSUBISHI', created_at: '2026-01-01T00:00:00Z' },
      { id: 5, name: 'SINOTRUK', created_at: '2026-01-01T00:00:00Z' },
      { id: 6, name: 'SITRAK', created_at: '2026-01-01T00:00:00Z' },
      { id: 7, name: 'RENAULT', created_at: '2026-01-01T00:00:00Z' },
    ],
    charge_types: [
      { id: 1, name: 'visite_technique', display_name: 'Visite technique', frequency: '12_months', due_date_type: 'variable', description: null, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'taxe_transport', display_name: 'Taxe transport', frequency: 'annual', due_date_type: 'fixed', description: null, created_at: '2026-01-01T00:00:00Z' },
      { id: 3, name: 'taxe_essieu', display_name: 'Taxe à l\'essieu', frequency: 'annual', due_date_type: 'fixed', description: null, created_at: '2026-01-01T00:00:00Z' },
      { id: 4, name: 'chrono_tachygraphe', display_name: 'Chrono tachygraphe', frequency: '24_months', due_date_type: 'variable', description: null, created_at: '2026-01-01T00:00:00Z' },
      { id: 5, name: 'assurance', display_name: 'Assurance', frequency: 'annual', due_date_type: 'fixed', description: null, created_at: '2026-01-01T00:00:00Z' },
    ],
    vehicles: [
      {
        id: 1,
        code: 'SMG-001',
        registration_plate: '12345-A-1',
        vehicle_type: 'Tracteur',
        type_id: 4,
        brand: 'MAN',
        brand_id: 1,
        fuel_type: 'Diesel',
        fuel_type_id: 1,
        purchase_date: '2022-03-15',
        category_id: 1,
        status: 'active',
        ptac: 44,
        puissance_fiscale: 19,
        notes: 'Tracteur porte-char principal',
        created_at: '2026-01-05T10:00:00Z',
        updated_at: '2026-01-05T10:00:00Z',
      },
      {
        id: 2,
        code: 'SMG-002',
        registration_plate: '23456-B-1',
        vehicle_type: 'Benne',
        type_id: 1,
        brand: 'IVECO',
        brand_id: 2,
        fuel_type: 'Diesel',
        fuel_type_id: 1,
        purchase_date: '2023-06-10',
        category_id: 3,
        status: 'active',
        ptac: 26,
        puissance_fiscale: 14,
        notes: 'Benne chantier',
        created_at: '2026-01-06T10:00:00Z',
        updated_at: '2026-01-06T10:00:00Z',
      },
      {
        id: 3,
        code: 'SMG-003',
        registration_plate: '34567-D-6',
        vehicle_type: 'Camion plateau',
        type_id: 6,
        brand: 'RENAULT',
        brand_id: 7,
        fuel_type: 'Diesel',
        fuel_type_id: 1,
        purchase_date: '2021-11-20',
        category_id: 2,
        status: 'active',
        ptac: 32,
        puissance_fiscale: 16,
        notes: null,
        created_at: '2026-01-07T10:00:00Z',
        updated_at: '2026-01-07T10:00:00Z',
      },
      {
        id: 4,
        code: 'SMG-004',
        registration_plate: '45678-E-1',
        vehicle_type: 'Pickup',
        type_id: 3,
        brand: 'MITSUBISHI',
        brand_id: 4,
        fuel_type: 'Diesel',
        fuel_type_id: 1,
        purchase_date: '2024-02-01',
        category_id: 4,
        status: 'active',
        ptac: 3.2,
        puissance_fiscale: 9,
        notes: 'Véhicule utilitaire',
        created_at: '2026-01-08T10:00:00Z',
        updated_at: '2026-01-08T10:00:00Z',
      },
    ],
    charges: [
      { id: 1, vehicle_id: 1, charge_type_id: 1, amount: 1450, year: CURRENT_YEAR, notes: null, created_at: '2026-01-10T00:00:00Z', updated_at: '2026-01-10T00:00:00Z' },
      { id: 2, vehicle_id: 1, charge_type_id: 2, amount: 4200, year: CURRENT_YEAR, notes: null, created_at: '2026-01-10T00:00:00Z', updated_at: '2026-01-10T00:00:00Z' },
      { id: 3, vehicle_id: 1, charge_type_id: 3, amount: 6500, year: CURRENT_YEAR, notes: null, created_at: '2026-01-10T00:00:00Z', updated_at: '2026-01-10T00:00:00Z' },
      { id: 4, vehicle_id: 1, charge_type_id: 4, amount: 1800, year: CURRENT_YEAR, notes: null, created_at: '2026-01-10T00:00:00Z', updated_at: '2026-01-10T00:00:00Z' },
      { id: 5, vehicle_id: 1, charge_type_id: 5, amount: 16500, year: CURRENT_YEAR, notes: null, created_at: '2026-01-10T00:00:00Z', updated_at: '2026-01-10T00:00:00Z' },
      { id: 6, vehicle_id: 2, charge_type_id: 1, amount: 1200, year: CURRENT_YEAR, notes: null, created_at: '2026-01-11T00:00:00Z', updated_at: '2026-01-11T00:00:00Z' },
      { id: 7, vehicle_id: 2, charge_type_id: 3, amount: 4800, year: CURRENT_YEAR, notes: null, created_at: '2026-01-11T00:00:00Z', updated_at: '2026-01-11T00:00:00Z' },
      { id: 8, vehicle_id: 2, charge_type_id: 5, amount: 12400, year: CURRENT_YEAR, notes: null, created_at: '2026-01-11T00:00:00Z', updated_at: '2026-01-11T00:00:00Z' },
      { id: 9, vehicle_id: 3, charge_type_id: 1, amount: 1350, year: CURRENT_YEAR, notes: null, created_at: '2026-01-12T00:00:00Z', updated_at: '2026-01-12T00:00:00Z' },
      { id: 10, vehicle_id: 3, charge_type_id: 2, amount: 3600, year: CURRENT_YEAR, notes: null, created_at: '2026-01-12T00:00:00Z', updated_at: '2026-01-12T00:00:00Z' },
      { id: 11, vehicle_id: 3, charge_type_id: 5, amount: 14200, year: CURRENT_YEAR, notes: null, created_at: '2026-01-12T00:00:00Z', updated_at: '2026-01-12T00:00:00Z' },
      { id: 12, vehicle_id: 4, charge_type_id: 1, amount: 650, year: CURRENT_YEAR, notes: null, created_at: '2026-01-13T00:00:00Z', updated_at: '2026-01-13T00:00:00Z' },
      { id: 13, vehicle_id: 4, charge_type_id: 5, amount: 6800, year: CURRENT_YEAR, notes: null, created_at: '2026-01-13T00:00:00Z', updated_at: '2026-01-13T00:00:00Z' },
    ],
    import_logs: [],
    tacho_suppliers: [
      { id: 1, name: 'Chrono Service Maroc', contact_name: 'Karim Tazi', phone: '0522-401122', email: 'contact@chronoservice.ma', address: 'Zone Industrielle Ain Sebaa, Casablanca', notes: null, active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'Tacho Pro Nord', contact_name: 'Nabil Idrissi', phone: '0539-314455', email: 'atelier@tachopro.ma', address: 'Tanger', notes: null, active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    ],
    tacho_operation_types: [
      { id: 1, code: 'reparation', name_fr: 'Réparation', name_en: 'Repair', default_interval_months: null, requires_certificate: false, sort_order: 10, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, code: 'revision_periodique', name_fr: 'Révision périodique', name_en: 'Periodic revision', default_interval_months: 24, requires_certificate: true, sort_order: 20, created_at: '2026-01-01T00:00:00Z' },
      { id: 3, code: 'revision_papier', name_fr: 'Révision papier', name_en: 'Paper revision', default_interval_months: 24, requires_certificate: true, sort_order: 30, created_at: '2026-01-01T00:00:00Z' },
      { id: 4, code: 'etalonnage', name_fr: 'Étalonnage', name_en: 'Calibration', default_interval_months: 24, requires_certificate: true, sort_order: 40, created_at: '2026-01-01T00:00:00Z' },
      { id: 5, code: 'installation', name_fr: 'Installation', name_en: 'Installation', default_interval_months: null, requires_certificate: false, sort_order: 50, created_at: '2026-01-01T00:00:00Z' },
    ],
    tacho_supplier_tariffs: [
      { id: 1, supplier_id: 1, operation_type_id: 2, price: 1500, valid_from: `${CURRENT_YEAR}-01-01`, valid_to: null, notes: null, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, supplier_id: 1, operation_type_id: 4, price: 1200, valid_from: `${CURRENT_YEAR}-01-01`, valid_to: null, notes: null, created_at: '2026-01-01T00:00:00Z' },
      { id: 3, supplier_id: 2, operation_type_id: 2, price: 1400, valid_from: `${CURRENT_YEAR}-01-01`, valid_to: null, notes: null, created_at: '2026-01-01T00:00:00Z' },
      { id: 4, supplier_id: 2, operation_type_id: 3, price: 950, valid_from: `${CURRENT_YEAR}-01-01`, valid_to: null, notes: null, created_at: '2026-01-01T00:00:00Z' },
    ],
    tacho_operations: [
      {
        id: 1,
        vehicle_id: 1,
        supplier_id: 1,
        operation_type_id: 2,
        performed_on: `${CURRENT_YEAR}-10-15`,
        price_paid: 1500,
        vat_rate: 20,
        vat_amount: 300,
        total_ttc: 1800,
        certificate_no: 'CERT-2026-088',
        certificate_expiry: `${CURRENT_YEAR + 2}-10-15`,
        next_due_on: `${CURRENT_YEAR + 2}-10-15`,
        chantier: 'Tanger Med',
        reference: 'BL-2026-104',
        purchase_order: 'BC-2026-051',
        notes: null,
        demand_id: null,
        created_at: '2026-10-15T10:00:00Z',
        updated_at: '2026-10-15T10:00:00Z',
      },
    ],
    tacho_operation_items: [
      { id: 1, operation_id: 1, operation_type_id: 2, vehicle_id: 1, quantity: 1, unit_price: 1500, price: 1500 },
    ],
    tacho_demands: [
      {
        id: 1,
        reference: `DEM-${CURRENT_YEAR}-0001`,
        status: 'open',
        requested_on: `${CURRENT_YEAR}-11-10`,
        chantier: 'Chantier Kénitra',
        requested_by: 'Chef de Parc',
        notes: 'Contrôle périodique avant déplacement',
        operation_id: null,
        created_by: '00000000-0000-4000-8000-000000000001',
        created_at: '2026-11-10T09:00:00Z',
        updated_at: '2026-11-10T09:00:00Z',
      },
    ],
    tacho_demand_items: [
      { id: 1, demand_id: 1, vehicle_id: 3, kind: 'visite_periodique', created_at: '2026-11-10T09:00:00Z' },
    ],
  }
}

const PASSWORDS: Record<string, string> = {
  'admin@smg.local': 'admin',
  'demo@smg-fleet.ma': 'demo123456',
}

// Many-to-one foreign-key map: childTable -> { embedKey: [fkColumn, parentTable] }
const BELONGS_TO: Record<string, Record<string, [string, string]>> = {
  vehicles: {
    category: ['category_id', 'vehicle_categories'],
    vehicle_categories: ['category_id', 'vehicle_categories'],
    type: ['type_id', 'vehicle_types'],
    vehicle_types: ['type_id', 'vehicle_types'],
    brand_rel: ['brand_id', 'brands'],
    fuel_type_rel: ['fuel_type_id', 'fuel_types'],
  },
  charges: {
    vehicle: ['vehicle_id', 'vehicles'],
    vehicles: ['vehicle_id', 'vehicles'],
    charge_type: ['charge_type_id', 'charge_types'],
    charge_types: ['charge_type_id', 'charge_types'],
  },
  tacho_operations: {
    vehicle: ['vehicle_id', 'vehicles'],
    vehicles: ['vehicle_id', 'vehicles'],
    supplier: ['supplier_id', 'tacho_suppliers'],
    tacho_suppliers: ['supplier_id', 'tacho_suppliers'],
    operation_type: ['operation_type_id', 'tacho_operation_types'],
    tacho_operation_types: ['operation_type_id', 'tacho_operation_types'],
    demand: ['demand_id', 'tacho_demands'],
    tacho_demands: ['demand_id', 'tacho_demands'],
  },
  tacho_operation_items: {
    operation: ['operation_id', 'tacho_operations'],
    tacho_operations: ['operation_id', 'tacho_operations'],
    operation_type: ['operation_type_id', 'tacho_operation_types'],
    tacho_operation_types: ['operation_type_id', 'tacho_operation_types'],
    vehicle: ['vehicle_id', 'vehicles'],
    vehicles: ['vehicle_id', 'vehicles'],
  },
  tacho_demands: {
    operation: ['operation_id', 'tacho_operations'],
    tacho_operations: ['operation_id', 'tacho_operations'],
  },
  tacho_demand_items: {
    demand: ['demand_id', 'tacho_demands'],
    tacho_demands: ['demand_id', 'tacho_demands'],
    vehicle: ['vehicle_id', 'vehicles'],
    vehicles: ['vehicle_id', 'vehicles'],
  },
  tacho_supplier_tariffs: {
    supplier: ['supplier_id', 'tacho_suppliers'],
    tacho_suppliers: ['supplier_id', 'tacho_suppliers'],
    operation_type: ['operation_type_id', 'tacho_operation_types'],
    tacho_operation_types: ['operation_type_id', 'tacho_operation_types'],
  },
}

// One-to-many map: parentTable -> { embedKey: [childTable, childFkColumn] }
const HAS_MANY: Record<string, Record<string, [string, string]>> = {
  vehicle_categories: {
    vehicles: ['vehicles', 'category_id'],
  },
  vehicle_types: {
    vehicles: ['vehicles', 'type_id'],
  },
  fuel_types: {
    vehicles: ['vehicles', 'fuel_type_id'],
  },
  charge_types: {
    charges: ['charges', 'charge_type_id'],
  },
  tacho_suppliers: {
    tacho_supplier_tariffs: ['tacho_supplier_tariffs', 'supplier_id'],
    tariffs: ['tacho_supplier_tariffs', 'supplier_id'],
  },
  tacho_operation_types: {
    tacho_operations: ['tacho_operations', 'operation_type_id'],
    tacho_operation_items: ['tacho_operation_items', 'operation_type_id'],
    tacho_supplier_tariffs: ['tacho_supplier_tariffs', 'operation_type_id'],
  },
  tacho_operations: {
    items: ['tacho_operation_items', 'operation_id'],
    tacho_operation_items: ['tacho_operation_items', 'operation_id'],
  },
  tacho_demands: {
    items: ['tacho_demand_items', 'demand_id'],
    tacho_demand_items: ['tacho_demand_items', 'demand_id'],
  },
}

function splitTopLevelCommas(str: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of str) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      if (cur.trim()) parts.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

function ilikeMatch(val: any, pattern: string): boolean {
  if (val == null) return false
  const escaped = String(pattern)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.')
  return new RegExp(`^${escaped}$`, 'i').test(String(val))
}

function compareVals(a: any, b: any): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

export function createMockSupabaseClient() {
  const db = createInitialDb()
  const nextIds: Record<string, number> = {}
  for (const [table, rows] of Object.entries(db)) {
    nextIds[table] = rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1
  }
  let demandSeq = 2

  const listeners = new Set<(event: string, session: any) => void>()

  function readStoredSession() {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function writeStoredSession(session: any) {
    try {
      if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
      else localStorage.removeItem(SESSION_STORAGE_KEY)
    } catch {
      // ignore storage errors
    }
  }

  let currentSession: any = readStoredSession()

  function getNextId(table: string): number {
    nextIds[table] = nextIds[table] || 1
    return nextIds[table]++
  }

  function computeVehicleSummaryForYear(year: number): Row[] {
    return db.vehicles.map((v) => {
      const cat = db.vehicle_categories.find((c) => c.id === v.category_id) || null
      const vt = db.vehicle_types.find((t) => t.id === v.type_id) || null
      const br = db.brands.find((b) => b.id === v.brand_id) || null
      const ft = db.fuel_types.find((f) => f.id === v.fuel_type_id) || null
      const vCharges = db.charges.filter((c) => c.vehicle_id === v.id && Number(c.year) === Number(year))
      return {
        id: v.id,
        code: v.code,
        registration_plate: v.registration_plate,
        vehicle_type: v.vehicle_type,
        type_id: v.type_id ?? null,
        type_name: vt?.name ?? null,
        brand: v.brand,
        brand_id: v.brand_id ?? null,
        brand_name: br?.name ?? null,
        fuel_type: v.fuel_type,
        fuel_type_id: v.fuel_type_id ?? null,
        fuel_type_name: ft?.name ?? null,
        purchase_date: v.purchase_date,
        status: v.status,
        notes: v.notes ?? null,
        ptac: v.ptac ?? null,
        puissance_fiscale: v.puissance_fiscale ?? null,
        category_id: v.category_id ?? null,
        category_name: cat?.name ?? null,
        charge_count: vCharges.length,
        total_charges: vCharges.reduce((s, c) => s + (Number(c.amount) || 0), 0),
      }
    })
  }

  function getTableRows(table: string): Row[] {
    if (table === 'vehicle_summary') return computeVehicleSummaryForYear(CURRENT_YEAR)
    if (!db[table]) db[table] = []
    return db[table]
  }

  function projectRow(table: string, row: Row, selectStr: string): Row {
    const clean = (selectStr || '*').trim()
    if (clean === '*') return deepClone(row)
    const tokens = splitTopLevelCommas(clean)
    const out: Row = {}
    let includeAllScalars = false

    for (const token of tokens) {
      if (token === '*') {
        includeAllScalars = true
        continue
      }
      const embedMatch = token.match(/^([^:(]+?)(?::([^!(]+?))?(?:!([^(]+))?\(([\s\S]*)\)$/)
      if (embedMatch) {
        const [, aliasOrTable, explicitTable, _hint, innerSelect] = embedMatch
        const fieldName = aliasOrTable.trim()
        const relKey = (explicitTable || aliasOrTable).trim()
        const inner = innerSelect.trim()

        const belongs = BELONGS_TO[table]?.[fieldName] || BELONGS_TO[table]?.[relKey]
        if (belongs) {
          const [fkCol, parentTable] = belongs
          const fkVal = row[fkCol]
          const parentRow = fkVal == null ? null : getTableRows(parentTable).find((p) => p.id === fkVal) || null
          out[fieldName] = parentRow ? projectRow(parentTable, parentRow, inner) : null
          continue
        }

        const hasMany = HAS_MANY[table]?.[fieldName] || HAS_MANY[table]?.[relKey]
        if (hasMany) {
          const [childTable, childFk] = hasMany
          const children = getTableRows(childTable).filter((c) => c[childFk] === row.id)
          if (inner === 'count') {
            out[fieldName] = [{ count: children.length }]
          } else {
            out[fieldName] = children.map((c) => projectRow(childTable, c, inner))
          }
          continue
        }

        out[fieldName] = []
        continue
      }

      const col = token.trim()
      if (col in row) out[col] = deepClone(row[col])
      else out[col] = null
    }

    if (includeAllScalars) {
      return { ...deepClone(row), ...out }
    }
    return out
  }

  function evalOrClause(row: Row, expr: string): boolean {
    const parts = splitTopLevelCommas(expr)
    return parts.some((part) => {
      const m = part.match(/^([^.]+)\.([^.]+)\.(.*)$/)
      if (!m) return false
      const [, col, op, rawVal] = m
      const rowVal = row[col]
      if (op === 'ilike') return ilikeMatch(rowVal, rawVal)
      if (op === 'eq') return String(rowVal) === String(rawVal)
      if (op === 'neq') return String(rowVal) !== String(rawVal)
      if (op === 'is') return rawVal === 'null' ? rowVal == null : String(rowVal) === rawVal
      return false
    })
  }

  function applyCascadeDelete(table: string, deletedRows: Row[]) {
    const ids = new Set(deletedRows.map((r) => r.id))
    if (!ids.size) return
    if (table === 'vehicles') {
      db.charges = db.charges.filter((c) => !ids.has(c.vehicle_id))
    } else if (table === 'tacho_operations') {
      db.tacho_operation_items = db.tacho_operation_items.filter((it) => !ids.has(it.operation_id))
      for (const d of db.tacho_demands) {
        if (ids.has(d.operation_id)) d.operation_id = null
      }
    } else if (table === 'tacho_demands') {
      db.tacho_demand_items = db.tacho_demand_items.filter((it) => !ids.has(it.demand_id))
    } else if (table === 'tacho_suppliers') {
      db.tacho_supplier_tariffs = db.tacho_supplier_tariffs.filter((t) => !ids.has(t.supplier_id))
    } else if (table === 'tacho_operation_types') {
      db.tacho_supplier_tariffs = db.tacho_supplier_tariffs.filter((t) => !ids.has(t.operation_type_id))
    }
  }

  function normalizeInsertRow(table: string, raw: Row): Row {
    const now = new Date().toISOString()
    const row: Row = deepClone(raw)
    if (row.id == null) {
      row.id = getNextId(table)
    }
    if (row.created_at === undefined) row.created_at = now
    if (row.updated_at === undefined && ['vehicles', 'charges', 'vehicle_categories', 'tacho_suppliers', 'tacho_operations', 'tacho_demands'].includes(table)) {
      row.updated_at = now
    }
    if (table === 'tacho_operations') {
      const rate = row.vat_rate ?? 20
      row.vat_rate = rate
      if (row.price_paid != null) {
        row.vat_amount = Math.round(Number(row.price_paid) * (Number(rate) / 100) * 100) / 100
        row.total_ttc = Math.round((Number(row.price_paid) + row.vat_amount) * 100) / 100
      } else {
        row.vat_amount = null
        row.total_ttc = null
      }
    }
    if (table === 'tacho_demands') {
      if (!row.reference || !String(row.reference).trim()) {
        const yearStr = String(row.requested_on || new Date().toISOString().slice(0, 10)).slice(0, 4)
        row.reference = `DEM-${yearStr}-${String(demandSeq++).padStart(4, '0')}`
      }
      if (!row.status) row.status = 'open'
      if (!row.created_by) row.created_by = currentSession?.user?.id ?? '00000000-0000-4000-8000-000000000001'
    }
    return row
  }

  function createQueryBuilder(table: string, initialDataset?: Row[], initialCountMode?: string | null) {
    let op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
    let selectCols = '*'
    let countMode: string | null = initialCountMode ?? null
    let payload: any = null
    let upsertOpts: { onConflict?: string } = {}
    let returnAfterWrite = false
    const filters: Array<(row: Row) => boolean> = []
    const orders: Array<{ column: string; ascending: boolean }> = []
    let rangeBounds: [number, number] | null = null
    let limitVal: number | null = null
    let expectSingle: 'single' | 'maybeSingle' | null = null

    function execute(): { data: any; error: any; count: number | null } {
      try {
        if (op === 'insert') {
          const list = Array.isArray(payload) ? payload : [payload]
          const inserted = list.map((item) => normalizeInsertRow(table, item))
          getTableRows(table).push(...inserted)
          if (!returnAfterWrite) {
            return { data: null, error: null, count: null }
          }
          const projected = inserted.map((r) => projectRow(table, r, selectCols))
          if (expectSingle) {
            return { data: projected[0] ?? null, error: null, count: null }
          }
          return { data: projected, error: null, count: null }
        }

        if (op === 'upsert') {
          const list = Array.isArray(payload) ? payload : [payload]
          const conflictCols = (upsertOpts.onConflict || 'id')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          const rows = getTableRows(table)
          const affected: Row[] = []
          for (const item of list) {
            const match = rows.find((existing) =>
              conflictCols.every((col) => existing[col] === item[col])
            )
            if (match) {
              Object.assign(match, deepClone(item), { updated_at: new Date().toISOString() })
              affected.push(match)
            } else {
              const created = normalizeInsertRow(table, item)
              rows.push(created)
              affected.push(created)
            }
          }
          if (!returnAfterWrite) return { data: null, error: null, count: null }
          const projected = affected.map((r) => projectRow(table, r, selectCols))
          if (expectSingle) return { data: projected[0] ?? null, error: null, count: null }
          return { data: projected, error: null, count: null }
        }

        if (op === 'update') {
          const rows = getTableRows(table)
          const matched = rows.filter((r) => filters.every((fn) => fn(r)))
          const now = new Date().toISOString()
          for (const r of matched) {
            Object.assign(r, deepClone(payload))
            if ('updated_at' in r) r.updated_at = now
            if (table === 'tacho_operations') {
              const rate = r.vat_rate ?? 20
              if (r.price_paid != null) {
                r.vat_amount = Math.round(Number(r.price_paid) * (Number(rate) / 100) * 100) / 100
                r.total_ttc = Math.round((Number(r.price_paid) + r.vat_amount) * 100) / 100
              }
            }
          }
          if (!returnAfterWrite) return { data: null, error: null, count: null }
          const projected = matched.map((r) => projectRow(table, r, selectCols))
          if (expectSingle === 'single') {
            if (!projected.length) return { data: null, error: { message: 'Row not found' }, count: null }
            return { data: projected[0], error: null, count: null }
          }
          if (expectSingle === 'maybeSingle') {
            return { data: projected[0] ?? null, error: null, count: null }
          }
          return { data: projected, error: null, count: null }
        }

        if (op === 'delete') {
          const rows = getTableRows(table)
          const kept: Row[] = []
          const removed: Row[] = []
          for (const r of rows) {
            if (filters.every((fn) => fn(r))) removed.push(r)
            else kept.push(r)
          }
          db[table] = kept
          applyCascadeDelete(table, removed)
          return { data: returnAfterWrite ? removed : null, error: null, count: null }
        }

        // SELECT
        const source = initialDataset ? deepClone(initialDataset) : getTableRows(table)
        let rows = source.filter((r) => filters.every((fn) => fn(r)))
        if (orders.length) {
          rows = [...rows].sort((a, b) => {
            for (const o of orders) {
              const cmp = compareVals(a[o.column], b[o.column])
              if (cmp !== 0) return o.ascending ? cmp : -cmp
            }
            return 0
          })
        }
        const totalCount = countMode ? rows.length : null
        if (rangeBounds) {
          rows = rows.slice(rangeBounds[0], rangeBounds[1] + 1)
        } else if (limitVal != null) {
          rows = rows.slice(0, limitVal)
        }
        const projected = initialDataset ? rows : rows.map((r) => projectRow(table, r, selectCols))

        if (expectSingle === 'single') {
          if (projected.length === 0) {
            return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, count: totalCount }
          }
          return { data: projected[0], error: null, count: totalCount }
        }
        if (expectSingle === 'maybeSingle') {
          return { data: projected[0] ?? null, error: null, count: totalCount }
        }
        return { data: projected, error: null, count: totalCount }
      } catch (err: any) {
        return { data: null, error: { message: err?.message || 'Mock query error' }, count: null }
      }
    }

    const builder: any = {
      select(cols = '*', opts?: { count?: string }) {
        if (op === 'insert' || op === 'upsert' || op === 'update' || op === 'delete') {
          returnAfterWrite = true
          selectCols = cols
        } else {
          op = 'select'
          selectCols = cols
          if (opts?.count) countMode = opts.count
        }
        return builder
      },
      insert(rows: any) {
        op = 'insert'
        payload = rows
        return builder
      },
      upsert(rows: any, opts?: { onConflict?: string }) {
        op = 'upsert'
        payload = rows
        upsertOpts = opts || {}
        return builder
      },
      update(patch: any) {
        op = 'update'
        payload = patch
        return builder
      },
      delete() {
        op = 'delete'
        return builder
      },
      eq(col: string, val: any) {
        filters.push((r) => r[col] === val || (val != null && String(r[col]) === String(val) && typeof r[col] === typeof val))
        return builder
      },
      neq(col: string, val: any) {
        filters.push((r) => r[col] !== val)
        return builder
      },
      is(col: string, val: any) {
        filters.push((r) => (val === null ? r[col] == null : r[col] === val))
        return builder
      },
      not(col: string, operator: string, val: any) {
        if (operator === 'is' && val === null) {
          filters.push((r) => r[col] != null)
        } else if (operator === 'eq') {
          filters.push((r) => r[col] !== val)
        }
        return builder
      },
      gte(col: string, val: any) {
        filters.push((r) => r[col] != null && r[col] >= val)
        return builder
      },
      lte(col: string, val: any) {
        filters.push((r) => r[col] != null && r[col] <= val)
        return builder
      },
      ilike(col: string, pattern: string) {
        filters.push((r) => ilikeMatch(r[col], pattern))
        return builder
      },
      or(expr: string) {
        filters.push((r) => evalOrClause(r, expr))
        return builder
      },
      order(column: string, opts?: { ascending?: boolean }) {
        orders.push({ column, ascending: opts?.ascending !== false })
        return builder
      },
      range(from: number, to: number) {
        rangeBounds = [from, to]
        return builder
      },
      limit(n: number) {
        limitVal = n
        return builder
      },
      single() {
        expectSingle = 'single'
        return builder
      },
      maybeSingle() {
        expectSingle = 'maybeSingle'
        return builder
      },
      then(onFulfilled: (res: any) => any, onRejected?: (err: any) => any) {
        return Promise.resolve(execute()).then(onFulfilled, onRejected)
      },
    }
    return builder
  }

  return {
    from(table: string) {
      return createQueryBuilder(table)
    },

    rpc(fn: string, params: Row = {}, opts?: { count?: string }) {
      if (fn === 'vehicle_summary_for_year') {
        const year = Number(params.p_year) || CURRENT_YEAR
        return createQueryBuilder('vehicle_summary', computeVehicleSummaryForYear(year), opts?.count ?? null)
      }
      if (fn === 'create_app_user') {
        const email = String(params.p_email || '').trim().toLowerCase()
        const username = String(params.p_username || '').trim() || email.split('@')[0]
        const authId = `00000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`
        const userRow = normalizeInsertRow('users', {
          auth_id: authId,
          username,
          email,
          display_name: params.p_display_name || username,
          role: params.p_role || 'user',
          permissions: params.p_permissions || [],
        })
        db.users.push(userRow)
        PASSWORDS[email] = params.p_password || 'admin'
        return Promise.resolve({ data: [deepClone(userRow)], error: null })
      }
      if (fn === 'set_app_user_password') {
        const u = db.users.find((x) => x.id === Number(params.p_user_id))
        if (!u) return Promise.resolve({ data: false, error: null })
        PASSWORDS[u.email] = params.p_new_password
        return Promise.resolve({ data: true, error: null })
      }
      if (fn === 'delete_app_user') {
        const u = db.users.find((x) => x.id === Number(params.p_user_id))
        if (u) delete PASSWORDS[u.email]
        db.users = db.users.filter((x) => x.id !== Number(params.p_user_id))
        return Promise.resolve({ data: true, error: null })
      }
      if (fn === 'update_own_profile') {
        const authId = currentSession?.user?.id
        const u = db.users.find((x) => x.auth_id === authId)
        if (!u) return Promise.resolve({ data: null, error: { message: 'User not found' } })
        u.display_name = String(params.p_display_name || '').trim() || u.display_name
        return Promise.resolve({ data: [deepClone(u)], error: null })
      }
      return Promise.resolve({ data: null, error: { message: `Unknown RPC: ${fn}` } })
    },

    auth: {
      async getSession() {
        return { data: { session: currentSession }, error: null }
      },
      async getUser() {
        return { data: { user: currentSession?.user ?? null }, error: null }
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const normEmail = String(email || '').trim().toLowerCase()
        const userRow = db.users.find((u) => u.email.toLowerCase() === normEmail || u.username.toLowerCase() === normEmail)
        if (!userRow || PASSWORDS[userRow.email] !== password) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } }
        }
        const session = {
          access_token: 'mock-access-token',
          user: { id: userRow.auth_id, email: userRow.email },
        }
        currentSession = session
        writeStoredSession(session)
        listeners.forEach((cb) => cb('SIGNED_IN', session))
        return { data: { user: session.user, session }, error: null }
      },
      async updateUser({ password }: { password?: string }) {
        const email = currentSession?.user?.email
        if (email && password) {
          PASSWORDS[email] = password
        }
        return { data: { user: currentSession?.user ?? null }, error: null }
      },
      async signOut() {
        currentSession = null
        writeStoredSession(null)
        listeners.forEach((cb) => cb('SIGNED_OUT', null))
        return { error: null }
      },
      onAuthStateChange(callback: (event: string, session: any) => void) {
        listeners.add(callback)
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                listeners.delete(callback)
              },
            },
          },
        }
      },
    },
  }
}
