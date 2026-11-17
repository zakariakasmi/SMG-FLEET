import { supabase } from './supabase'
import { monthlyAmount, getChargeTypeName, getChargeVehicleType } from '../utils/calculations'

// PostgREST caps a single response at the project's "Max Rows" setting
// (Supabase default: 1000) and silently truncates anything larger. Page through
// with .range() so aggregate views never compute on a partial dataset. Advance by
// the number of rows actually returned, not by REST_PAGE_SIZE: if the project's
// "Max Rows" is below our page size the server caps each page, and advancing by
// the requested size would silently skip rows.
const REST_PAGE_SIZE = 1000

async function fetchAllRows(buildQuery) {
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + REST_PAGE_SIZE - 1)
    if (error) throw error
    const batch = data || []
    rows.push(...batch)
    if (batch.length === 0) break
    from += batch.length
  }
  return rows
}

function isMissingWwPlateError(error) {
  const msg = String(error?.message || '')
  const details = String(error?.details || '')
  return (
    (error?.code === '42703' || error?.code === 'PGRST204') &&
    (msg.includes('ww_plate') || details.includes('ww_plate'))
  )
}

// =====================================================
// VEHICLES
// =====================================================
export const vehiclesApi = {
  async list(filters = {}) {
    const run = async (includeWw) => {
      let query = supabase
        .from('vehicles')
        .select(`
          *,
          category:vehicle_categories(id, name)
        `)
        .order('created_at', { ascending: false })

      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.search) {
        const clauses = [
          `code.ilike.%${filters.search}%`,
          `registration_plate.ilike.%${filters.search}%`,
          ...(includeWw ? [`ww_plate.ilike.%${filters.search}%`] : []),
        ]
        query = query.or(clauses.join(','))
      }
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId)
      }
      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      return query
    }

    let { data, error } = await run(true)
    if (error && isMissingWwPlateError(error)) {
      ;({ data, error } = await run(false))
    }
    if (error) throw error
    return data
  },

  // Server-side search/filter/sort/pagination backed by the vehicle_summary_for_year
  // RPC — the view can't take a filter, so the function takes the year as an argument.
  // Returns { data, count } — the list page never loads the whole fleet.
  async search(filters = {}) {
    const {
      search = '',
      status = '',
      type = '',
      brand = '',
      categoryId = '',
      hp = '',
      tonnage = '',
      sortBy = 'code',
      sortDir = 'asc',
      page = 1,
      pageSize = 10,
      year = new Date().getFullYear(),
    } = filters

    const SORTABLE = {
      code: 'code',
      registration_plate: 'registration_plate',
      ww_plate: 'ww_plate',
      vehicle_type: 'vehicle_type',
      brand: 'brand',
      status: 'status',
      puissance_fiscale: 'puissance_fiscale',
      ptac: 'ptac',
      category_name: 'category_name',
      total_charges: 'total_charges',
    }
    const ascending = sortDir !== 'desc'
    const safePage = Math.max(1, parseInt(page, 10) || 1)
    const safePageSize = Math.max(1, parseInt(pageSize, 10) || 10)
    const from = (safePage - 1) * safePageSize

    const runSearch = async ({ includeWw, extraSearchIds = [] }) => {
      const column = !includeWw && sortBy === 'ww_plate' ? 'code' : SORTABLE[sortBy] || 'code'
      let query = supabase
        .rpc('vehicle_summary_for_year', { p_year: Number(year) || new Date().getFullYear() }, { count: 'exact' })
        .order(column, { ascending })

      if (search) {
        const clauses = [
          `code.ilike.%${search}%`,
          `registration_plate.ilike.%${search}%`,
          ...(includeWw ? [`ww_plate.ilike.%${search}%`] : []),
          `vehicle_type.ilike.%${search}%`,
          `brand.ilike.%${search}%`,
          `category_name.ilike.%${search}%`,
          ...(extraSearchIds.length > 0 ? [`id.in.(${extraSearchIds.join(',')})`] : []),
        ]
        query = query.or(clauses.join(','))
      }
      if (status) query = query.eq('status', status)
      if (type) query = query.eq('vehicle_type', type)
      if (brand) query = query.eq('brand', brand)
      if (categoryId) query = query.eq('category_id', categoryId)
      if (hp) query = query.eq('puissance_fiscale', Number(hp))
      if (tonnage) query = query.eq('ptac', Number(tonnage))

      query = query.range(from, from + safePageSize - 1)
      return query
    }

    let { data, count, error } = await runSearch({ includeWw: true })
    if (error && isMissingWwPlateError(error)) {
      let extraSearchIds = []
      if (search) {
        const wwMatch = await supabase.from('vehicles').select('id').ilike('ww_plate', `%${search}%`)
        if (!wwMatch.error && wwMatch.data?.length) {
          extraSearchIds = wwMatch.data.map((r) => r.id)
        }
      }
      ;({ data, count, error } = await runSearch({ includeWw: false, extraSearchIds }))
    }
    if (error) throw error

    let rows = data || []
    if (rows.length > 0 && !Object.prototype.hasOwnProperty.call(rows[0], 'ww_plate')) {
      const ids = rows.map((r) => r.id).filter(Boolean)
      if (ids.length > 0) {
        const wwRes = await supabase.from('vehicles').select('id, ww_plate').in('id', ids)
        if (!wwRes.error && wwRes.data) {
          const byId = new Map(wwRes.data.map((r) => [r.id, r.ww_plate ?? null]))
          rows = rows.map((r) => ({ ...r, ww_plate: byId.get(r.id) ?? null }))
        }
      }
    }

    return { data: rows, count: count || 0 }
  },

  // Distinct brands plus the canonical vehicle types for the server-side filter
  // dropdowns. Types come from the vehicle_types reference table (Settings) so the
  // filter always lists exactly the same types the rest of the app uses.
  async listOptions() {
    const [brandsRes, typesRes] = await Promise.all([
      supabase.from('vehicles').select('brand'),
      supabase.from('vehicle_types').select('name').order('name'),
    ])
    if (brandsRes.error) throw brandsRes.error
    if (typesRes.error) throw typesRes.error

    const brands = [...new Set((brandsRes.data || []).map((r) => r.brand).filter(Boolean))].sort()
    const types = (typesRes.data || []).map((r) => r.name).filter(Boolean)
    return { brands, types }
  },

  async getByCode(code) {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        category:vehicle_categories(id, name)
      `)
      .eq('code', code)
      .single()
    if (error) throw error
    return data
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        category:vehicle_categories(id, name)
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async create(vehicle) {
    let { data, error } = await supabase
      .from('vehicles')
      .insert([vehicle])
      .select()
      .single()
    if (error && isMissingWwPlateError(error) && 'ww_plate' in vehicle) {
      const { ww_plate: _omitted, ...withoutWw } = vehicle
      ;({ data, error } = await supabase.from('vehicles').insert([withoutWw]).select().single())
    }
    if (error) throw error
    return data
  },

  async update(id, updates) {
    let { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error && isMissingWwPlateError(error) && 'ww_plate' in updates) {
      const { ww_plate: _omitted, ...withoutWw } = updates
      ;({ data, error } = await supabase.from('vehicles').update(withoutWw).eq('id', id).select().single())
    }
    if (error) throw error
    return data
  },

  async delete(id) {
    const { error } = await supabase.from('vehicles').delete().eq('id', id)
    if (error) throw error
  },

  async findByCode(code) {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (error) throw error
    return data
  },

  // Lean id/code/plate list used by the import wizard for duplicate
  // detection and FK resolution — never loads the full fleet.
  async listKeys() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, code, registration_plate')
    if (error) throw error
    return data || []
  },
}

// =====================================================
// CHARGES
// =====================================================
export const chargesApi = {
  async list(filters = {}) {
    const buildQuery = () => {
      let query = supabase
        .from('charges')
        .select(`
          *,
          vehicle:vehicles(id, code, registration_plate),
          charge_type:charge_types(id, name, display_name)
        `)
        .order('created_at', { ascending: false })
        // Stable tiebreaker so .range() pagination never skips/duplicates rows.
        .order('id', { ascending: true })

      if (filters.vehicleId) {
        query = query.eq('vehicle_id', filters.vehicleId)
      }
      if (filters.chargeTypeId) {
        query = query.eq('charge_type_id', filters.chargeTypeId)
      }
      // Charges are year-scoped: default to the current year so every view shows
      // one amount per charge type. Pass allYears:true to bypass (full exports).
      if (!filters.allYears) {
        query = query.eq('year', filters.year || new Date().getFullYear())
      }
      return query
    }

    return fetchAllRows(buildQuery)
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('charges')
      .select(`
        *,
        vehicle:vehicles(id, code, registration_plate),
        charge_type:charge_types(id, name, display_name)
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async create(charge) {
    const { data, error } = await supabase
      .from('charges')
      .insert([{ ...charge, year: charge.year ?? new Date().getFullYear() }])
      .select()
      .single()
    if (error) throw error
    return data
  },

  async createBatch(charges) {
    const currentYear = new Date().getFullYear()
    const { data, error } = await supabase
      .from('charges')
      .insert(
        charges.map((c) => ({
          vehicle_id: c.vehicle_id,
          charge_type_id: c.charge_type_id,
          amount: c.amount,
          notes: c.notes ?? null,
          year: c.year ?? currentYear,
        }))
      )
      .select()
    if (error) throw error
    return data
  },

  async upsertBatch(charges) {
    const currentYear = new Date().getFullYear()
    const { data, error } = await supabase
      .from('charges')
      .upsert(
        charges.map((c) => ({
          vehicle_id: c.vehicle_id,
          charge_type_id: c.charge_type_id,
          amount: c.amount,
          notes: c.notes ?? null,
          year: c.year ?? currentYear,
        })),
        { onConflict: 'vehicle_id,charge_type_id,year' }
      )
      .select()
    if (error) throw error
    return data
  },

  // Distinct years currently stored, newest first (drives the import renew panel).
  async listYears() {
    const { data, error } = await supabase.from('charges').select('year')
    if (error) throw error
    const years = [...new Set((data || []).map((c) => c.year).filter((y) => y != null))].sort((a, b) => b - a)
    return years
  },

  // Copies each active vehicle's charges from sourceYear to targetYear with the
  // same amounts so they can be adjusted. Idempotent (upsert on year+type).
  async renewYear(sourceYear, targetYear) {
    const source = sourceYear ?? new Date().getFullYear()
    const target = targetYear ?? source + 1

    const { data, error } = await supabase
      .from('charges')
      .select('vehicle_id, charge_type_id, amount, vehicle:vehicles(status)')
      .eq('year', source)
    if (error) throw error

    const rows = (data || [])
      .filter((r) => r.vehicle?.status === 'active')
      .map((r) => ({ vehicle_id: r.vehicle_id, charge_type_id: r.charge_type_id, amount: r.amount, year: target }))

    let added = 0
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      await this.upsertBatch(batch)
      added += batch.length
    }
    return { added, sourceYear: source, targetYear: target }
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('charges')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id) {
    const { error } = await supabase.from('charges').delete().eq('id', id)
    if (error) throw error
  },
}

// =====================================================
// CATEGORIES
// =====================================================
export const categoriesApi = {
  async list() {
    const { data, error } = await supabase
      .from('vehicle_categories')
      .select('*')
      .order('name')
    if (error) throw error
    return data
  },

  async create(category) {
    const { data, error } = await supabase
      .from('vehicle_categories')
      .insert([category])
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('vehicle_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id) {
    const { error } = await supabase.from('vehicle_categories').delete().eq('id', id)
    if (error) throw error
  },
}

// =====================================================
// CHARGE TYPES
// =====================================================
export const chargeTypesApi = {
  async list() {
    const { data, error } = await supabase
      .from('charge_types')
      .select('*')
      .order('id')
    if (error) throw error
    return data
  },

  async create(chargeType) {
    const { data, error } = await supabase
      .from('charge_types')
      .insert([chargeType])
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('charge_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id) {
    const { error } = await supabase.from('charge_types').delete().eq('id', id)
    if (error) throw error
  },
}

// =====================================================
// VEHICLE TYPES
// =====================================================
export const vehicleTypesApi = {
  async list() {
    const { data, error } = await supabase
      .from('vehicle_types')
      .select('*')
      .order('name')
    if (error) throw error
    return data
  },

  // Resolve a vehicle type by name (case-insensitive), creating it if missing.
  // Keeps vehicles linked to the reference table instead of writing free text
  // with a null type_id and drifting away from Settings.
  async resolveByName(rawName) {
    const name = String(rawName ?? '').trim()
    if (!name) return null
    const { data: existing, error: findError } = await supabase
      .from('vehicle_types')
      .select('*')
      .ilike('name', name)
      .limit(1)
      .maybeSingle()
    if (findError) throw findError
    if (existing) return existing
    return this.create({ name })
  },

  async create(vehicleType) {
    const { data, error } = await supabase
      .from('vehicle_types')
      .insert([vehicleType])
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('vehicle_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id) {
    const { error } = await supabase.from('vehicle_types').delete().eq('id', id)
    if (error) throw error
  },
}

// =====================================================
// FUEL TYPES
// =====================================================
export const fuelTypesApi = {
  async list() {
    const { data, error } = await supabase
      .from('fuel_types')
      .select('*')
      .order('name')
    if (error) throw error
    return data
  },

  // Resolve a fuel type by name (case-insensitive), creating it if missing.
  // Keeps imported vehicles linked to the reference table instead of leaving
  // their fuel_type_id null and drifting away from Settings.
  async resolveByName(rawName) {
    const name = String(rawName ?? '').trim()
    if (!name) return null
    const { data: existing, error: findError } = await supabase
      .from('fuel_types')
      .select('*')
      .ilike('name', name)
      .limit(1)
      .maybeSingle()
    if (findError) throw findError
    if (existing) return existing
    return this.create({ name })
  },

  async create(fuelType) {
    const { data, error } = await supabase
      .from('fuel_types')
      .insert([fuelType])
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('fuel_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id) {
    const { error } = await supabase.from('fuel_types').delete().eq('id', id)
    if (error) throw error
  },
}

// =====================================================
// USERS
// =====================================================
const USER_COLUMNS = 'id, username, email, auth_id, display_name, role, permissions, created_at'

async function fetchProfileByAuthId(authId) {
  const { data, error } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .eq('auth_id', authId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

export const usersApi = {
  async list() {
    const { data, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .order('created_at')
    if (error) throw error
    return data
  },

  async create(user) {
    const { data, error } = await supabase
      .rpc('create_app_user', {
        p_email: user.email,
        p_password: user.password,
        p_display_name: user.display_name || '',
        p_role: user.role || 'user',
        p_permissions: user.permissions || [],
        p_username: user.username || '',
      })
    if (error) throw error
    return data[0]
  },

  async update(id, updates) {
    const { password, ...profile } = updates || {}
    if (password) {
      const { error: pwError } = await supabase
        .rpc('set_app_user_password', { p_user_id: id, p_new_password: password })
      if (pwError) throw pwError
    }
    if (profile && Object.keys(profile).length > 0) {
      const { data, error } = await supabase
        .from('users')
        .update(profile)
        .eq('id', id)
        .select(USER_COLUMNS)
        .single()
      if (error) throw error
      return data
    }
    return null
  },

  async delete(id) {
    const { error } = await supabase.rpc('delete_app_user', { p_user_id: id })
    if (error) throw error
  },

  async login(email, password) {
    const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) throw signInError
    return fetchProfileByAuthId(signIn.user.id)
  },

  async get(id) {
    const { data, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async getByAuthId(authId) {
    return fetchProfileByAuthId(authId)
  },

  async changePassword(email, currentPassword, newPassword) {
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (verifyError) throw new Error('INVALID_CURRENT_PASSWORD')

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) throw updateError

    const { data: authUser } = await supabase.auth.getUser()
    return fetchProfileByAuthId(authUser.user.id)
  },

  async updateProfile(id, profile) {
    const { data, error } = await supabase.rpc('update_own_profile', {
      p_display_name: profile.display_name,
    })
    if (error) throw error
    return data[0]
  },
}

// =====================================================
// DASHBOARD
// =====================================================
export const dashboardApi = {
  async getDashboardData(year, { includeCharges = true } = {}) {
    const targetYear = year || new Date().getFullYear()

    const [vehiclesRes, charges, chargeTypesRes, categoriesRes] = await Promise.all([
      supabase
        .from('vehicles')
        .select('id, status, category_id, brand, vehicle_type, code, registration_plate')
        .eq('status', 'active'),
      includeCharges
        ? fetchAllRows(() =>
            supabase
              .from('charges')
              .select(`
                amount,
                vehicle:vehicles(id, category_id, brand, vehicle_type, code, registration_plate),
                charge_type:charge_types(id, name, display_name)
              `)
              .eq('year', targetYear)
              .order('id', { ascending: true })
          )
        : Promise.resolve([]),
      includeCharges
        ? supabase.from('charge_types').select('id, name, display_name').order('id')
        : Promise.resolve({ data: [], error: null }),
      supabase.from('vehicle_categories').select('id, name').order('name'),
    ])

    for (const res of [vehiclesRes, chargeTypesRes, categoriesRes]) {
      if (res.error) throw res.error
    }

    const vehicles = vehiclesRes.data || []
    const chargeTypes = chargeTypesRes.data || []
    const categories = categoriesRes.data || []

    const chargeMonthly = (ch) => monthlyAmount(ch.amount, getChargeTypeName(ch), getChargeVehicleType(ch))

    // Per-category aggregation (including an "uncategorized" bucket for null category_id)
    const catFleetIds = new Map()
    const brandFleetIds = new Map()
    const brandMap = new Map()
    const vehicleChargeMap = new Map()

    // Vehicle counts are a fleet fact, not a charge fact: count every active
    // vehicle regardless of charges, so newly imported vehicles show up. Only
    // the charge amounts below are scoped to the selected year.
    for (const v of vehicles) {
      const cid = v.category_id ?? null
      if (!catFleetIds.has(cid)) catFleetIds.set(cid, new Set())
      catFleetIds.get(cid).add(v.id)
      const vb = v.brand || '—'
      if (!brandFleetIds.has(vb)) brandFleetIds.set(vb, new Set())
      brandFleetIds.get(vb).add(v.id)
      if (!brandMap.has(vb)) brandMap.set(vb, { brand: vb, vehicles: 0, total: 0, monthly: 0 })
    }

    const catMap = new Map()
    for (const c of categories) {
      catMap.set(c.id, { id: c.id, name: c.name, vehicles: 0, totalCharges: 0, monthly: 0, byType: {} })
    }
    catMap.set(null, { id: null, name: null, vehicles: 0, totalCharges: 0, monthly: 0, byType: {} })

    const typeTotals = new Map()
    for (const ct of chargeTypes) {
      typeTotals.set(ct.name, { id: ct.id, name: ct.name, display_name: ct.display_name, total: 0, vehicleCount: 0, monthly: 0 })
    }

    const typeVehiclesSeen = new Set()

    for (const ch of charges) {
      const vid = ch.vehicle?.id
      const catId = ch.vehicle?.category_id ?? null
      const typeName = ch.charge_type?.name
      const amount = Number(ch.amount) || 0
      const monthly = chargeMonthly(ch)

      const cat = catMap.get(catId)
      if (cat) {
        cat.totalCharges += amount
        cat.monthly += monthly
        if (typeName) cat.byType[typeName] = (cat.byType[typeName] || 0) + amount
      }
      if (typeName && typeTotals.has(typeName)) {
        const entry = typeTotals.get(typeName)
        entry.total += amount
        entry.monthly += monthly
        const key = `${typeName}:${ch.vehicle?.id}`
        if (!typeVehiclesSeen.has(key)) {
          typeVehiclesSeen.add(key)
          entry.vehicleCount += 1
        }
      }

      const vb = ch.vehicle?.brand || '—'
      if (!brandMap.has(vb)) {
        brandMap.set(vb, {
          brand: vb,
          vehicles: 0,
          total: 0,
          monthly: 0,
        })
      }
      const brandEntry = brandMap.get(vb)
      brandEntry.total += amount
      brandEntry.monthly += monthly

      if (vid != null) {
        if (!vehicleChargeMap.has(vid)) {
          const v = ch.vehicle
          vehicleChargeMap.set(vid, {
            id: vid,
            code: v?.code || '',
            registration_plate: v?.registration_plate || '',
            vehicle_type: v?.vehicle_type || '',
            brand: v?.brand || '',
            total: 0,
            monthly: 0,
          })
        }
        const ve = vehicleChargeMap.get(vid)
        ve.total += amount
        ve.monthly += monthly
      }
    }

    for (const c of categories) {
      const cat = catMap.get(c.id)
      if (cat) cat.vehicles = (catFleetIds.get(c.id) || new Set()).size
    }
    const nullCat = catMap.get(null)
    nullCat.vehicles = (catFleetIds.get(null) || new Set()).size
    for (const be of brandMap.values()) {
      be.vehicles = (brandFleetIds.get(be.brand) || new Set()).size
    }

    const pivot = [...catMap.values()]
      .filter((c) => c.vehicles > 0 || c.totalCharges > 0)
      .map((c) => ({
        categoryId: c.id,
        categoryName: c.name,
        vehicles: c.vehicles,
        byType: c.byType,
        total: c.totalCharges,
        monthly: c.monthly,
      }))
      .sort((a, b) => b.total - a.total)

    const chargesByType = [...typeTotals.values()]
      .sort((a, b) => b.total - a.total)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        display_name: entry.display_name,
        total: entry.total,
        vehicleCount: entry.vehicleCount,
        monthly: entry.monthly,
      }))

    const brands = [...brandMap.values()].sort((a, b) => b.total - a.total)

    const vehicleCharges = [...vehicleChargeMap.values()].sort((a, b) => b.total - a.total)

    const fleetTotalByType = {}
    for (const ct of chargeTypes) {
      fleetTotalByType[ct.name] = typeTotals.get(ct.name).total
    }
    const grandTotal = charges.reduce((sum, ch) => sum + (Number(ch.amount) || 0), 0)
    const monthlyTotal = charges.reduce((sum, ch) => sum + chargeMonthly(ch), 0)

    return {
      year: targetYear,
      totalVehicles: vehicles.length,
      categories: pivot.map((p) => ({
        id: p.categoryId,
        name: p.categoryName,
        vehicles: p.vehicles,
        totalCharges: p.total,
        monthly: p.monthly,
      })),
      chargesByType,
      pivot,
      brands,
      vehicleCharges,
      typeColumns: chargeTypes,
      fleetTotalByType,
      grandTotal,
      monthlyTotal,
    }
  },
}

// =====================================================
// REFERENCE ITEM USAGE COUNTS (settings reference tables)
// =====================================================
async function countByRelation(from, child) {
  const { data, error } = await supabase.from(from).select(`id, ${child}(count)`)
  if (error) throw error
  const map = {}
  for (const row of data || []) map[row.id] = row[child]?.[0]?.count ?? 0
  return map
}

export const referenceCountsApi = {
  categories() {
    return countByRelation('vehicle_categories', 'vehicles')
  },
  vehicleTypes() {
    return countByRelation('vehicle_types', 'vehicles')
  },
  fuelTypes() {
    return countByRelation('fuel_types', 'vehicles')
  },
  chargeTypes() {
    return countByRelation('charge_types', 'charges')
  },
  tachographOperationTypes() {
    // A type can be referenced by an operation header (primary article) and by
    // its priced lines; the delete guard needs the sum of both.
    return Promise.all([
      countByRelation('tacho_operation_types', 'tacho_operations'),
      countByRelation('tacho_operation_types', 'tacho_operation_items'),
    ]).then(([headers, lines]) => {
      const merged = { ...headers }
      for (const [id, count] of Object.entries(lines)) merged[id] = (merged[id] || 0) + count
      return merged
    })
  },
}

// =====================================================
// IMPORT LOGS
// =====================================================
export const importLogsApi = {
  async create(log) {
    const { data, error } = await supabase
      .from('import_logs')
      .insert([log])
      .select()
      .single()
    if (error) throw error
    return data
  },
}

// =====================================================
// TACHOGRAPH (supplier costs, revisions, quotes)
// =====================================================
// Separate from `charges.chrono_tachygraphe`: that is the annual cost line on a
// vehicle; this is the intervention/quote book behind it. See
// supabase/2026-10-29-tachograph-module.sql.
const DEFAULT_VAT_RATE = 20

// The FK hint on the demand embed is mandatory: tacho_operations and
// tacho_demands point at each other, so PostgREST answers PGRST201 (ambiguous
// relationship) without it.
const TACHO_OPERATION_SELECT_BASE = `
  *,
  vehicle:vehicles(id, code, registration_plate, vehicle_type, status),
  supplier:tacho_suppliers(id, name),
  operation_type:tacho_operation_types(id, code, name_fr, name_en, default_interval_months, requires_certificate),
  demand:tacho_demands!tacho_operations_demand_id_fkey(id, reference, status),
  items:tacho_operation_items(
    id, operation_id, operation_type_id, vehicle_id, quantity, unit_price, price,
    operation_type:tacho_operation_types(id, code, name_fr, name_en),
    vehicle:vehicles(id, code, registration_plate)
  )
`

const TACHO_OPERATION_SELECT = `
  *,
  vehicle:vehicles(id, code, registration_plate, ww_plate, vehicle_type, status),
  supplier:tacho_suppliers(id, name),
  operation_type:tacho_operation_types(id, code, name_fr, name_en, default_interval_months, requires_certificate),
  demand:tacho_demands!tacho_operations_demand_id_fkey(id, reference, status),
  items:tacho_operation_items(
    id, operation_id, operation_type_id, vehicle_id, quantity, unit_price, price,
    operation_type:tacho_operation_types(id, code, name_fr, name_en),
    vehicle:vehicles(id, code, registration_plate, ww_plate)
  )
`

// A demand (bon de demande) is the site's request to the fleet manager: "this
// vehicle needs a repair / a periodic inspection". It carries no supplier and
// no BL/BC — those belong to the operation logged afterwards, which is why the
// operation embed also brings `reference` (the BL) and `purchase_order` (the
// BC) for the printable sheet. See
// supabase/2026-11-12-tachograph-demands-simple.sql.
const TACHO_DEMAND_SELECT_BASE = `
  *,
  operation:tacho_operations!tacho_demands_operation_id_fkey(id, performed_on, reference, purchase_order),
  items:tacho_demand_items(
    id, demand_id, vehicle_id, kind,
    vehicle:vehicles(id, code, registration_plate)
  )
`

const TACHO_DEMAND_SELECT = `
  *,
  operation:tacho_operations!tacho_demands_operation_id_fkey(id, performed_on, reference, purchase_order),
  items:tacho_demand_items(
    id, demand_id, vehicle_id, kind,
    vehicle:vehicles(id, code, registration_plate, ww_plate)
  )
`

// Lightweight shape for the header notification bell: the reference, the site
// and the vehicles are all a "new demand" alert needs.
const TACHO_DEMAND_BELL_SELECT = `
  id, reference, requested_on, chantier, requested_by,
  items:tacho_demand_items(id, kind, vehicle:vehicles(id, code, registration_plate))
`

// Line prices are HT. `price_paid` is their sum (also HT); `vat_amount` and
// `total_ttc` are generated by Postgres from `vat_rate`, so they are never
// written from here.
function tachoOperationRow(op) {
  return {
    vehicle_id: op.vehicle_id ? Number(op.vehicle_id) : null,
    supplier_id: Number(op.supplier_id),
    operation_type_id: Number(op.operation_type_id),
    performed_on: op.performed_on || null,
    price_paid: op.price_paid === '' || op.price_paid == null ? null : Number(op.price_paid),
    vat_rate: op.vat_rate === '' || op.vat_rate == null ? DEFAULT_VAT_RATE : Number(op.vat_rate),
    certificate_no: op.certificate_no?.trim() || null,
    certificate_expiry: op.certificate_expiry || null,
    next_due_on: op.next_due_on || null,
    chantier: op.chantier?.trim() || null,
    reference: op.reference?.trim() || null,
    purchase_order: op.purchase_order?.trim() || null,
    notes: op.notes?.trim() || null,
    // Only touched when the caller knows about it: an edit form that does not
    // carry the link must not clear it.
    ...(op.demand_id !== undefined
      ? { demand_id: op.demand_id ? Number(op.demand_id) : null }
      : {}),
  }
}

// The demand header. Status has its own method (setDemandStatus) so a plain
// edit can never move it by accident.
function tachoDemandRow(demand) {
  return {
    requested_on: demand.requested_on || null,
    chantier: demand.chantier?.trim() || null,
    requested_by: demand.requested_by?.trim() || null,
    notes: demand.notes?.trim() || null,
  }
}

// One line = one vehicle + one kind ('reparation' | 'visite_periodique'). The
// precise operation type is chosen later, when the operation is logged.
function tachoDemandItemRows(demand) {
  const source = Array.isArray(demand.items) ? demand.items : []
  return source
    .filter((item) => item && item.vehicle_id && item.kind)
    .map((item) => ({
      vehicle_id: Number(item.vehicle_id),
      kind: item.kind,
    }))
}

async function replaceDemandItems(demandId, items) {
  const { error: deleteError } = await supabase
    .from('tacho_demand_items')
    .delete()
    .eq('demand_id', demandId)
  if (deleteError) throw deleteError

  const { error } = await supabase
    .from('tacho_demand_items')
    .insert(items.map((item) => ({ ...item, demand_id: demandId })))
  if (error) throw error
}

// One intervention is billed as several article lines. Each line carries its
// own vehicle, quantity and unit price, so the same article can be booked on
// several vehicles as separate lines. The first line is also stored on the
// header (article + vehicle) so the filters and due logic keep working.
function tachoOperationItemRows(operation) {
  const source = Array.isArray(operation.items) ? operation.items : []
  return source
    .filter((item) => item && item.operation_type_id)
    .map((item) => {
      const quantity = item.quantity === '' || item.quantity == null ? 1 : Number(item.quantity)
      const unitPrice = item.unit_price === '' || item.unit_price == null ? 0 : Number(item.unit_price)
      return {
        operation_type_id: Number(item.operation_type_id),
        vehicle_id: item.vehicle_id ? Number(item.vehicle_id) : null,
        quantity,
        unit_price: unitPrice,
        price: Math.round(quantity * unitPrice * 100) / 100,
      }
    })
}

function tachoOperationHeader(operation, items) {
  return tachoOperationRow({
    ...operation,
    operation_type_id: items[0].operation_type_id,
    vehicle_id: items[0].vehicle_id || operation.vehicle_id,
    price_paid: items.reduce((sum, item) => sum + item.price, 0),
  })
}

async function replaceOperationItems(operationId, items) {
  const { error: deleteError } = await supabase
    .from('tacho_operation_items')
    .delete()
    .eq('operation_id', operationId)
  if (deleteError) throw deleteError

  const { error } = await supabase
    .from('tacho_operation_items')
    .insert(items.map((item) => ({ ...item, operation_id: operationId })))
  if (error) throw error
}

// Logging the operation fulfils the demand end to end: the link is kept and the
// demand is automatically completed (Terminé). There is nothing left to do on
// the demand side.
async function linkDemandToOperation(demandId, operation) {
  const id = Number(demandId)
  const { error } = await supabase
    .from('tacho_demands')
    .update({
      operation_id: operation.id,
      status: 'closed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

function tachoSupplierRow(supplier) {
  return {
    name: supplier.name?.trim(),
    contact_name: supplier.contact_name?.trim() || null,
    phone: supplier.phone?.trim() || null,
    email: supplier.email?.trim() || null,
    address: supplier.address?.trim() || null,
    notes: supplier.notes?.trim() || null,
    active: supplier.active !== false,
  }
}

function tachoOperationTypeRow(type) {
  const months = type.default_interval_months
  return {
    code: type.code?.trim(),
    name_fr: type.name_fr?.trim(),
    name_en: type.name_en?.trim(),
    default_interval_months: months === '' || months == null ? null : Number(months),
    requires_certificate: !!type.requires_certificate,
    sort_order: Number(type.sort_order) || 0,
  }
}

export const tachographApi = {
  // --- suppliers ---
  async listSuppliers() {
    const { data, error } = await supabase
      .from('tacho_suppliers')
      .select('*')
      .order('name')
    if (error) throw error
    return data || []
  },

  async createSupplier(supplier) {
    const { data, error } = await supabase
      .from('tacho_suppliers')
      .insert([tachoSupplierRow(supplier)])
      .select()
      .single()
    if (error) throw error
    return data
  },

  async updateSupplier(id, updates) {
    const { data, error } = await supabase
      .from('tacho_suppliers')
      .update({ ...tachoSupplierRow(updates), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteSupplier(id) {
    const { error } = await supabase.from('tacho_suppliers').delete().eq('id', id)
    if (error) throw error
  },

  // --- operation types ---
  async listOperationTypes() {
    const { data, error } = await supabase
      .from('tacho_operation_types')
      .select('*')
      .order('sort_order')
      .order('name_fr')
    if (error) throw error
    return data || []
  },

  async createOperationType(type) {
    const { data, error } = await supabase
      .from('tacho_operation_types')
      .insert([tachoOperationTypeRow(type)])
      .select()
      .single()
    if (error) throw error
    return data
  },

  async updateOperationType(id, updates) {
    const { data, error } = await supabase
      .from('tacho_operation_types')
      .update(tachoOperationTypeRow(updates))
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteOperationType(id) {
    const { error } = await supabase.from('tacho_operation_types').delete().eq('id', id)
    if (error) throw error
  },

  // --- supplier tariffs (item prices per supplier) ---
  async listTariffs(supplierId = null) {
    let query = supabase
      .from('tacho_supplier_tariffs')
      .select('*, supplier:tacho_suppliers(id, name), operation_type:tacho_operation_types(id, code, name_fr, name_en)')
      .order('valid_from', { ascending: false })
      .order('id', { ascending: false })
    if (supplierId) query = query.eq('supplier_id', Number(supplierId))
    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async saveSupplierTariffs(supplierId, entries) {
    const sid = Number(supplierId)
    const { data: existingRows, error: fetchError } = await supabase
      .from('tacho_supplier_tariffs')
      .select('*')
      .eq('supplier_id', sid)
      .order('valid_from', { ascending: false })
      .order('id', { ascending: false })
    if (fetchError) throw fetchError

    const existingByType = new Map()
    for (const row of existingRows || []) {
      const typeId = Number(row.operation_type_id)
      if (!existingByType.has(typeId)) existingByType.set(typeId, row)
    }

    const today = new Date().toISOString().slice(0, 10)
    for (const entry of entries || []) {
      const typeId = Number(entry.operation_type_id)
      const current = existingByType.get(typeId)
      const rawPrice = entry.price
      const hasPrice = rawPrice !== '' && rawPrice != null && !Number.isNaN(Number(rawPrice))

      if (!hasPrice) {
        if (current) {
          const { error } = await supabase
            .from('tacho_supplier_tariffs')
            .delete()
            .eq('supplier_id', sid)
            .eq('operation_type_id', typeId)
          if (error) throw error
        }
        continue
      }

      const price = Math.round(Number(rawPrice) * 100) / 100
      const notes = entry.notes?.trim() || null
      if (current) {
        const { error } = await supabase
          .from('tacho_supplier_tariffs')
          .update({ price, notes })
          .eq('id', current.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tacho_supplier_tariffs')
          .insert([{
            supplier_id: sid,
            operation_type_id: typeId,
            price,
            valid_from: entry.valid_from || today,
            valid_to: null,
            notes,
          }])
        if (error) throw error
      }
    }
    return this.listTariffs(sid)
  },

  async deleteTariff(id) {
    const { error } = await supabase.from('tacho_supplier_tariffs').delete().eq('id', id)
    if (error) throw error
  },

  // --- operations ---
  async listOperations(filters = {}) {
    const buildQuery = (selectStr) => () => {
      let query = supabase
        .from('tacho_operations')
        .select(selectStr)
        .order('performed_on', { ascending: false })
        // Stable tiebreaker so .range() pagination never skips/duplicates rows.
        .order('id', { ascending: false })

      if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId)
      if (filters.operationTypeId) query = query.eq('operation_type_id', filters.operationTypeId)
      if (filters.vehicleId) query = query.eq('vehicle_id', filters.vehicleId)
      if (filters.from) query = query.gte('performed_on', filters.from)
      if (filters.to) query = query.lte('performed_on', filters.to)
      return query
    }
    try {
      return await fetchAllRows(buildQuery(TACHO_OPERATION_SELECT))
    } catch (error) {
      if (isMissingWwPlateError(error)) {
        return fetchAllRows(buildQuery(TACHO_OPERATION_SELECT_BASE))
      }
      throw error
    }
  },

  async createOperation(operation) {
    const items = tachoOperationItemRows(operation)
    if (!items.length) throw new Error('An operation needs at least one item')

    const { data, error } = await supabase
      .from('tacho_operations')
      .insert([tachoOperationHeader(operation, items)])
      .select()
      .single()
    if (error) throw error

    try {
      await replaceOperationItems(data.id, items)
    } catch (e) {
      // Don't leave a header with no lines behind.
      await supabase.from('tacho_operations').delete().eq('id', data.id)
      throw e
    }

    // A demand is fulfilled by the operation logged from it: link it and mark
    // it as handled.
    if (operation.demand_id) {
      try {
        await linkDemandToOperation(operation.demand_id, data)
      } catch (e) {
        // The operation is already saved: a failed link must not be reported as
        // a failed save (the operator would retry and create a duplicate).
        console.error('Could not link the demand to its operation:', e)
      }
    }
    return { ...data, items }
  },

  async updateOperation(id, updates) {
    const items = tachoOperationItemRows(updates)
    if (!items.length) throw new Error('An operation needs at least one item')

    const { data, error } = await supabase
      .from('tacho_operations')
      .update({ ...tachoOperationHeader(updates, items), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    await replaceOperationItems(id, items)
    return { ...data, items }
  },

  async deleteOperation(id) {
    const { error } = await supabase.from('tacho_operations').delete().eq('id', id)
    if (error) throw error
  },

  // Operations still without a purchase order (BC). Backs the notification bell
  // in the header and the "missing BC" filter of the operations list: any
  // operation lacking a BC is an alert, oldest first so the most overdue line
  // is the one shown at the top.
  async listMissingPurchaseOrders() {
    const rows = await fetchAllRows(() =>
      supabase
        .from('tacho_operations')
        // The bell only needs the header, not the article lines.
        .select(
          'id, vehicle_id, performed_on, price_paid, reference, purchase_order, vehicle:vehicles(id, code, registration_plate), supplier:tacho_suppliers(id, name)'
        )
        .order('performed_on', { ascending: true })
        .order('id', { ascending: true })
    )

    // `purchase_order` is normalised to null on write, but a blank string from
    // an older row still counts as missing.
    return rows.filter((row) => !String(row.purchase_order || '').trim())
  },

  // Latest operation per vehicle that carries a next-due date. If a vehicle is
  // sold it has no future revision to book, so it is dropped here.
  async listDue() {
    const buildQuery = (selectStr) => () =>
      supabase
        .from('tacho_operations')
        .select(selectStr)
        .not('next_due_on', 'is', null)
        .order('performed_on', { ascending: false })
        .order('id', { ascending: false })

    let rows
    try {
      rows = await fetchAllRows(buildQuery(TACHO_OPERATION_SELECT))
    } catch (error) {
      if (isMissingWwPlateError(error)) {
        rows = await fetchAllRows(buildQuery(TACHO_OPERATION_SELECT_BASE))
      } else {
        throw error
      }
    }

    const latest = new Map()
    for (const row of rows) {
      if (row.vehicle?.status === 'sold') continue
      const key = row.vehicle_id ?? `op-${row.id}`
      if (!latest.has(key)) latest.set(key, row)
    }
    return [...latest.values()].sort((a, b) =>
      String(a.next_due_on).localeCompare(String(b.next_due_on))
    )
  },

  // --- demands (bons de demande) ---
  // `createdBy` (the auth user id) restricts the book to the demands raised by
  // one person. Callers pass it when the user is not a fleet manager; the same
  // rule is enforced by RLS, this keeps the query small and explicit.
  async listDemands(filters = {}) {
    const buildQuery = (selectStr) => () => {
      let query = supabase
        .from('tacho_demands')
        .select(selectStr)
        .order('requested_on', { ascending: false })
        // Stable tiebreaker so .range() pagination never skips/duplicates rows.
        .order('id', { ascending: false })

      if (filters.status) query = query.eq('status', filters.status)
      if (filters.createdBy) query = query.eq('created_by', filters.createdBy)
      return query
    }
    try {
      return await fetchAllRows(buildQuery(TACHO_DEMAND_SELECT))
    } catch (error) {
      if (isMissingWwPlateError(error)) {
        return fetchAllRows(buildQuery(TACHO_DEMAND_SELECT_BASE))
      }
      throw error
    }
  },

  // Demands still waiting for the fleet manager (En cours). Backs the header
  // notification bell; newest first. A demand that already carries its
  // operation is "Traité", never a new demand, so it is excluded even if its
  // stored status lags behind.
  async listOpenDemands() {
    return fetchAllRows(() =>
      supabase
        .from('tacho_demands')
        .select(TACHO_DEMAND_BELL_SELECT)
        .eq('status', 'open')
        .is('operation_id', null)
        .order('requested_on', { ascending: false })
        .order('id', { ascending: false })
    )
  },

  async getDemand(id) {
    let { data, error } = await supabase
      .from('tacho_demands')
      .select(TACHO_DEMAND_SELECT)
      .eq('id', id)
      .single()
    if (error && isMissingWwPlateError(error)) {
      ;({ data, error } = await supabase
        .from('tacho_demands')
        .select(TACHO_DEMAND_SELECT_BASE)
        .eq('id', id)
        .single())
    }
    if (error) throw error
    return data
  },

  async createDemand(demand) {
    const items = tachoDemandItemRows(demand)
    if (!items.length) throw new Error('A demand needs at least one vehicle')

    // `reference` is generated by the DB trigger (DEM-YYYY-NNNN).
    const { data, error } = await supabase
      .from('tacho_demands')
      .insert([tachoDemandRow(demand)])
      .select()
      .single()
    if (error) throw error

    try {
      await replaceDemandItems(data.id, items)
    } catch (e) {
      // Don't leave a header with no lines behind.
      await supabase.from('tacho_demands').delete().eq('id', data.id)
      throw e
    }
    return { ...data, items }
  },

  async updateDemand(id, updates) {
    const items = tachoDemandItemRows(updates)
    if (!items.length) throw new Error('A demand needs at least one vehicle')

    const { data, error } = await supabase
      .from('tacho_demands')
      .update({ ...tachoDemandRow(updates), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    await replaceDemandItems(id, items)
    return { ...data, items }
  },

  async deleteDemand(id) {
    const { error } = await supabase.from('tacho_demands').delete().eq('id', id)
    if (error) throw error
  },

  // En cours → Traité → Terminé. Logging the operation completes the demand
  // automatically (Terminé); "Traité" is the manual intermediate step for a
  // demand handled before its operation is logged.
  async setDemandStatus(id, status) {
    if (!['open', 'done', 'closed'].includes(status)) {
      throw new Error(`Unknown demand status: ${status}`)
    }
    const { error } = await supabase
      .from('tacho_demands')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },
}