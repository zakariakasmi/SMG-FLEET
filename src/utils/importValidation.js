// Column mapping + validation helpers for the import wizard.
// Validation is real: it resolves foreign keys and detects duplicate codes /
// registration plates both inside the file and against the live database.

export const normalizeHeader = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

export const normalizeWord = (s) =>
  normalizeHeader(s)
    .replace(/(^|_)(a|l|la|le|les|de|des|du|en|et|ou|aux|the|of)(_|$)/g, '_')
    .replace(/^_|_$/g, '')

export const isChargeTarget = (target) => typeof target === 'string' && target.startsWith('ct:')
export const chargeTypeIdFromTarget = (target) => Number(target.slice(3))
export const IGNORE_TARGET = '__ignore__'

export const VEHICLE_TARGETS = [
  {
    key: 'code',
    required: true,
    labelKey: 'import.fields.code',
    aliases: ['code', 'code_vehicule', 'vehicle_code', 'identifiant', 'reference', 'numero'],
  },
  {
    key: 'registration_plate',
    required: true,
    labelKey: 'import.fields.registration_plate',
    aliases: ['registration_plate', 'plaque', 'plaque_immatriculation', 'registration', 'matricule', 'plate', 'immatriculation'],
  },
  {
    key: 'ww_plate',
    required: false,
    labelKey: 'import.fields.ww_plate',
    aliases: ['ww_plate', 'ww', 'plaque_ww', 'matricule_ww', 'immatriculation_ww'],
  },
  {
    key: 'chassis_number',
    required: false,
    labelKey: 'import.fields.chassis_number',
    aliases: ['chassis_number', 'chassis', 'numero_chassis', 'numero_de_chassis', 'n_chassis', 'no_chassis', 'num_chassis', 'vin'],
  },
  {
    key: 'vehicle_type',
    required: true,
    labelKey: 'import.fields.vehicle_type',
    aliases: ['vehicle_type', 'vehicule_type', 'type', 'type_vehicule', 'type_de_vehicule', 'genre'],
  },
  {
    key: 'brand',
    required: true,
    labelKey: 'import.fields.brand',
    aliases: ['brand', 'marque', 'brand_name'],
  },
  {
    key: 'fuel_type',
    required: true,
    labelKey: 'import.fields.fuel_type',
    aliases: ['fuel_type', 'carburant', 'fuel', 'type_carburant', 'energie'],
  },
  {
    key: 'purchase_date',
    required: false,
    labelKey: 'import.fields.purchase_date',
    aliases: ['purchase_date', 'date_achat', 'date_dachat', 'achat', 'purchase'],
  },
  {
    key: 'category',
    required: true,
    labelKey: 'import.fields.category',
    aliases: ['category', 'categorie', 'cat', 'category_name', 'classe'],
  },
  {
    key: 'status',
    required: false,
    labelKey: 'import.fields.status',
    aliases: ['status', 'statut', 'etat', 'state'],
  },
  {
    key: 'puissance_fiscale',
    required: false,
    labelKey: 'import.fields.puissance_fiscale',
    aliases: ['puissance_fiscale', 'puissance', 'hp', 'chevaux', 'cv', 'fiscal_power', 'puissance_cv'],
  },
  {
    key: 'ptac',
    required: false,
    labelKey: 'import.fields.ptac',
    aliases: ['ptac', 'p_t_a_c', 'tonnage', 'ptac_kg', 'poids_total', 'poids'],
  },
  {
    key: 'notes',
    required: false,
    labelKey: 'import.fields.notes',
    aliases: ['notes', 'commentaire', 'commentaires', 'remarques', 'note'],
  },
]

export const CHARGE_BASE_TARGETS = [
  {
    key: 'code',
    required: true,
    labelKey: 'import.fields.code',
    aliases: ['code', 'code_vehicule', 'vehicle_code', 'identifiant', 'reference', 'numero'],
  },
  {
    key: 'notes',
    required: false,
    labelKey: 'import.fields.notes',
    aliases: ['notes', 'commentaire', 'commentaires', 'remarques', 'note'],
  },
]

const checkAliases = (header, defs) => {
  const normalized = normalizeHeader(header)
  for (const def of defs) {
    if (def.aliases.includes(normalized)) return def
  }
  return null
}

export function autoDetectMapping(headers, importType, chargeTypes) {
  const chargeTypeMap = {}
  ;(chargeTypes || []).forEach((ct) => {
    const key = normalizeWord(ct.name)
    if (key && !chargeTypeMap[key]) chargeTypeMap[key] = ct.id
    const displayKey = normalizeWord(ct.display_name)
    if (displayKey && !chargeTypeMap[displayKey]) chargeTypeMap[displayKey] = ct.id
  })

  return headers.map((header, index) => {
    let target = ''

    if (importType === 'vehicles') {
      target = checkAliases(header, VEHICLE_TARGETS)?.key || ''
    } else {
      const base = checkAliases(header, CHARGE_BASE_TARGETS)
      if (base) {
        target = base.key
      } else {
        const chargeTypeId = chargeTypeMap[normalizeWord(header)]
        if (chargeTypeId) target = `ct:${chargeTypeId}`
      }
    }

    return {
      header,
      index,
      target,
      auto: true,
    }
  })
}

// Returns mapping-level problems so the UI can block "Continue".
// Missing fields are the raw target keys; the page translates them.
export function validateMapping(mapping, importType) {
  const problems = []
  const assigned = new Map()

  mapping.forEach((m) => {
    if (!m.target || m.target === IGNORE_TARGET) return
    if (assigned.has(m.target)) {
      problems.push({ type: 'duplicate', target: m.target })
    }
    assigned.set(m.target, m.header)
  })

  if (importType === 'vehicles') {
    const missing = VEHICLE_TARGETS.filter((x) => x.required).filter((x) => !assigned.has(x.key))
    if (missing.length) {
      problems.push({ type: 'missingRequired', targets: missing.map((x) => x.key) })
    }
  } else {
    const chargeCount = [...assigned.keys()].filter((k) => isChargeTarget(k)).length
    if (chargeCount === 0) {
      problems.push({ type: 'missingChargeColumn' })
    }
  }

  return problems
}

const valueOf = (row, mapping, target) => {
  const m = (mapping || []).find((x) => x.target === target)
  if (!m) return ''
  const v = row ? row[m.header] : ''
  return v === null || v === undefined ? '' : String(v).trim()
}

export function parseDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, mo, d] = value.split('-').map(Number)
    const date = new Date(Date.UTC(y, mo - 1, d))
    if (date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d) {
      return value
    }
    return null
  }
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) {
    const d = Number(m[1])
    const mo = Number(m[2])
    const y = Number(m[3])
    const date = new Date(Date.UTC(y, mo - 1, d))
    if (date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
    return null
  }
  return null
}

export function parseNumber(value) {
  const s = String(value).replace(/\s/g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

const issue = (field, key, extra = {}) => ({ field, key, ...extra })

// Builds one validated vehicle row from a raw file row.
export function buildVehicleRow({ index, row, mapping, refData }) {
  const rowNumber = index + 1
  const issues = []

  const code = valueOf(row, mapping, 'code').toUpperCase()
  const registration_plate = valueOf(row, mapping, 'registration_plate').toUpperCase()
  const ww_plate = valueOf(row, mapping, 'ww_plate').toUpperCase() || null
  const chassis_number = valueOf(row, mapping, 'chassis_number').toUpperCase() || null
  const vehicle_type = valueOf(row, mapping, 'vehicle_type').toLowerCase()
  const brand = valueOf(row, mapping, 'brand')
  // Keep original casing: resolveByName matches case-insensitively, and newly
  // created fuel types should keep the spelling the caller provided.
  const fuel_type = valueOf(row, mapping, 'fuel_type')
  const category = valueOf(row, mapping, 'category')
  const status = valueOf(row, mapping, 'status').toLowerCase() || 'active'
  const notes = valueOf(row, mapping, 'notes') || null

  if (!code) {
    issues.push(issue('code', 'import.errors.required'))
  } else if (!/^[A-Z0-9]+$/.test(code)) {
    issues.push(issue('code', 'import.errors.codeFormat'))
  }
  if (!registration_plate) issues.push(issue('registration_plate', 'import.errors.required'))
  if (!vehicle_type) issues.push(issue('vehicle_type', 'import.errors.required'))
  if (!brand) issues.push(issue('brand', 'import.errors.required'))
  if (!fuel_type) issues.push(issue('fuel_type', 'import.errors.required'))

  let purchase_date = ''
  const rawDate = valueOf(row, mapping, 'purchase_date')
  if (rawDate) {
    const parsed = parseDate(rawDate)
    if (!parsed) {
      issues.push(issue('purchase_date', 'import.errors.invalidDate'))
    } else {
      purchase_date = parsed
    }
  }

  if (!['active', 'sold'].includes(status)) {
    issues.push(issue('status', 'import.errors.invalidStatus'))
  }

  let categoryId = null
  if (!category) {
    issues.push(issue('category', 'import.errors.required'))
  } else if (refData.categoryById.has(category.toLowerCase())) {
    categoryId = refData.categoryById.get(category.toLowerCase())
  } else if (/^\d+$/.test(category) && refData.categoryIds.has(Number(category))) {
    categoryId = Number(category)
  } else {
    issues.push(issue('category', 'import.errors.unknownCategory', { value: category }))
  }

  let puissance_fiscale = null
  const hpRaw = valueOf(row, mapping, 'puissance_fiscale')
  if (hpRaw) {
    const n = parseNumber(hpRaw)
    if (n === null || Number.isNaN(n) || n < 0) {
      issues.push(issue('puissance_fiscale', 'import.errors.invalidNumber'))
    } else {
      puissance_fiscale = Math.round(n)
    }
  }

  let ptac = null
  const ptacRaw = valueOf(row, mapping, 'ptac')
  if (ptacRaw) {
    const n = parseNumber(ptacRaw)
    if (n === null || Number.isNaN(n)) {
      issues.push(issue('ptac', 'import.errors.invalidNumber'))
    } else {
      ptac = n
    }
  }

  return {
    rowNumber,
    code,
    registration_plate,
    category,
    categoryId,
    purchase_date,
    status,
    issues,
    values: {
      code,
      registration_plate,
      ww_plate,
      chassis_number,
      vehicle_type,
      brand,
      fuel_type,
      purchase_date,
      category,
      categoryId,
      status,
      puissance_fiscale,
      ptac,
      notes,
    },
  }
}

// Builds one validated charge row (pivot format: code + amount per charge type).
export function buildChargeRow({ index, row, mapping, refData }) {
  const rowNumber = index + 1
  const issues = []
  const entries = []

  const code = valueOf(row, mapping, 'code').toUpperCase()
  const notes = valueOf(row, mapping, 'notes') || null

  let vehicleId = null
  if (!code) {
    issues.push(issue('code', 'import.errors.required'))
  } else {
    vehicleId = refData.vehicleIdByCode.get(code) || null
    if (!vehicleId) {
      issues.push(issue('code', 'import.errors.vehicleNotFound', { code }))
    }
  }

  mapping.forEach((m) => {
    if (!isChargeTarget(m.target)) return
    const raw = row ? row[m.header] : ''
    const trimmed = raw === null || raw === undefined ? '' : String(raw).trim()
    if (!trimmed) return

    const amount = parseNumber(trimmed)
    if (amount === null || Number.isNaN(amount) || amount <= 0) {
      issues.push(issue('charge', 'import.errors.invalidAmount', { value: trimmed, column: m.header }))
      return
    }
    if (vehicleId) {
      entries.push({
        rowNumber,
        vehicle_id: vehicleId,
        charge_type_id: chargeTypeIdFromTarget(m.target),
        amount,
        notes,
      })
    }
  })

  const noAmountIssues = !issues.some((i) => i.key === 'import.errors.invalidAmount')
  if (code && vehicleId && noAmountIssues && entries.length === 0) {
    issues.push(issue('row', 'import.errors.noCharges'))
  }

  return {
    rowNumber,
    code,
    vehicleId,
    issues,
    values: { code, notes },
    entries,
  }
}

// Runs DB-aware duplicate checks and computes the validation summary.
export function buildValidationState({ rawRows, mapping, importType, refData }) {
  const rows = rawRows.map((row, index) =>
    importType === 'vehicles'
      ? buildVehicleRow({ index, row, mapping, refData })
      : buildChargeRow({ index, row, mapping, refData })
  )

  if (importType === 'vehicles') {
    const seenCodes = new Set()
    const seenPlates = new Set()
    rows.forEach((row) => {
      if (row.issues.some((i) => i.key === 'import.errors.required' && i.field === 'code')) return

      if (seenCodes.has(row.code)) {
        row.issues.push(issue('code', 'import.errors.dupCodeInFile'))
      } else {
        seenCodes.add(row.code)
        const existing = refData.vehicleByCode.get(row.code)
        if (existing) {
          row.existingId = existing.id
        }
      }

      if (!row.registration_plate) return
      if (seenPlates.has(row.registration_plate)) {
        row.issues.push(issue('registration_plate', 'import.errors.dupPlateInFile'))
      } else {
        seenPlates.add(row.registration_plate)
        const plateOwner = refData.vehicleByPlate.get(row.registration_plate)
        if (plateOwner && plateOwner.id !== row.existingId) {
          row.issues.push(issue('registration_plate', 'import.errors.dupPlateInDb', { code: plateOwner.code }))
        }
      }
    })
  } else {
    const seenChargeKeys = new Set()
    rows.forEach((row) => {
      if (!row.vehicleId) return
      row.entries = row.entries.filter((entry) => {
        const key = `${entry.vehicle_id}|${entry.charge_type_id}`
        if (seenChargeKeys.has(key)) {
          row.issues.push(issue('charge', 'import.errors.dupCharge'))
          return false
        }
        seenChargeKeys.add(key)
        return true
      })
    })
  }

  rows.forEach((row) => {
    const hasError = row.issues.length > 0
    row.status = hasError ? 'invalid' : importType === 'vehicles' && row.existingId ? 'update' : 'valid'
  })

  const summary = {
    total: rows.length,
    valid: rows.filter((r) => r.status === 'valid' || r.status === 'update').length,
    invalid: rows.filter((r) => r.status === 'invalid').length,
    duplicates: rows.filter((r) => r.issues.some((i) => i.key.includes('dup'))).length,
    toAdd: importType === 'vehicles'
      ? rows.filter((r) => r.status === 'valid').length
      : rows.filter((r) => r.status === 'valid').reduce((n, r) => n + r.entries.length, 0),
    toUpdate: rows.filter((r) => r.status === 'update').length,
    toSkip: rows.filter((r) => r.status === 'invalid').length,
  }

  return { rows, summary }
}