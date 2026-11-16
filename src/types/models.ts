import type { Database } from './database'

export type VehicleRow = Database['public']['Tables']['vehicles']['Row']
export type VehicleInsert = Database['public']['Tables']['vehicles']['Insert']
export type VehicleUpdate = Database['public']['Tables']['vehicles']['Update']

export type ChargeRow = Database['public']['Tables']['charges']['Row']
export type ChargeInsert = Database['public']['Tables']['charges']['Insert']
export type ChargeUpdate = Database['public']['Tables']['charges']['Update']

export type VehicleCategory = Database['public']['Tables']['vehicle_categories']['Row']
export type ChargeType = Database['public']['Tables']['charge_types']['Row']
export type VehicleType = Database['public']['Tables']['vehicle_types']['Row']
export type FuelType = Database['public']['Tables']['fuel_types']['Row']
export type Brand = Database['public']['Tables']['brands']['Row']
export type ImportLog = Database['public']['Tables']['import_logs']['Row']

export type UserRow = Database['public']['Tables']['users']['Row']

export type VehicleSummaryRow = Database['public']['Views']['vehicle_summary']['Row']

// -----------------------------------------------------
// Roles and permissions (mirror src/constants/permissions.js
// and the RLS user_has_permission() helper)
// -----------------------------------------------------
export const ADMIN_ROLE = 'admin'
export const STANDARD_USER_ROLE = 'user'

export type UserRole = typeof ADMIN_ROLE | typeof STANDARD_USER_ROLE

export const PERMISSION_SCOPES = [
  'vehicles',
  'addVehicles',
  'editVehicles',
  'deleteVehicles',
  'charges',
  'addCharges',
  'editCharges',
  'deleteCharges',
  'import',
  'export',
  'manageTypes',
  'tachograph',
  'addTachograph',
  'editTachograph',
  'deleteTachograph',
  'viewAllTachographDemands',
] as const

export type PermissionScope = (typeof PERMISSION_SCOPES)[number]

export interface AppUser {
  id: number
  username: string
  email: string
  auth_id: string | null
  display_name: string | null
  role: UserRole
  permissions: PermissionScope[]
  created_at: string | null
}

// -----------------------------------------------------
// Joined shapes returned by the API layer
// -----------------------------------------------------
export interface Vehicle extends VehicleRow {
  category: Pick<VehicleCategory, 'id' | 'name'> | null
}

export interface Charge extends ChargeRow {
  vehicle: Pick<VehicleRow, 'id' | 'code' | 'registration_plate'> | null
  charge_type: Pick<ChargeType, 'id' | 'name' | 'display_name'> | null
}

export interface DashboardCharge {
  amount: number
  vehicle: Pick<VehicleRow, 'id' | 'category_id' | 'brand' | 'vehicle_type' | 'code' | 'registration_plate'> | null
  charge_type: Pick<ChargeType, 'id' | 'name' | 'display_name'> | null
}

export interface DashboardCategoryBucket {
  id: number | null
  name: string | null
  vehicles: number
  totalCharges: number
  monthly: number
  byType: Record<string, number>
}

export interface ChargeByType {
  id: number
  name: string
  display_name: string
  total: number
  vehicleCount: number
  monthly: number
}

export interface BrandBucket {
  brand: string
  vehicles: number
  total: number
  monthly: number
}

export interface VehicleChargeBucket {
  id: number
  code: string
  registration_plate: string
  vehicle_type: string
  brand: string
  total: number
  monthly: number
}

export interface DashboardData {
  year: number
  totalVehicles: number
  categories: Array<Omit<DashboardCategoryBucket, 'byType'> & { id: number | null; name: string | null }>
  chargesByType: ChargeByType[]
  pivot: Array<{
    categoryId: number | null
    categoryName: string | null
    vehicles: number
    byType: Record<string, number>
    total: number
    monthly: number
  }>
  brands: BrandBucket[]
  vehicleCharges: VehicleChargeBucket[]
  typeColumns: Pick<ChargeType, 'id' | 'name' | 'display_name'>[]
  fleetTotalByType: Record<string, number>
  grandTotal: number
  monthlyTotal: number
}

export interface ImportLogInput {
  filename: string
  total_rows: number
  added_count: number
  updated_count: number
  failed_count: number
  error_details?: Record<string, unknown> | null
}