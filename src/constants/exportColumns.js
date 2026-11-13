// Vehicle status enum
export const VEHICLE_STATUS = {
  ACTIVE: 'active',
  SOLD: 'sold',
}

export const VEHICLE_STATUS_LABELS = {
  active: 'Active',
  sold: 'Sold',
}

// Vehicle type options
export const VEHICLE_TYPES = [
  'camion',
  'minibus',
  'van',
  'pickup',
  'tracteur',
]

// Fuel type options
export const FUEL_TYPES = [
  'Diesel',
  'Essence',
  'Electric',
  'Gas',
  'Hybrid',
]

// Export column options
export const EXPORT_COLUMNS = {
  VEHICLE: [
    { key: 'code', label: 'Code' },
    { key: 'registration_plate', label: 'Registration Plate' },
    { key: 'vehicle_type', label: 'Vehicle Type' },
    { key: 'brand', label: 'Brand' },
    { key: 'puissance_fiscale', label: 'Fiscal HP' },
    { key: 'ptac', label: 'Tonnage' },
    { key: 'fuel_type', label: 'Fuel Type' },
    { key: 'purchase_date', label: 'Purchase Date' },
    { key: 'category_name', label: 'Category' },
    { key: 'status', label: 'Status' },
  ],
  CHARGE: [
    { key: 'charge_type', label: 'Charge Type' },
    { key: 'amount', label: 'Amount (MAD)' },
  ],
  OTHER: [
    { key: 'notes', label: 'Notes' },
    { key: 'year', label: 'Year' },
  ],
}

export const ALL_EXPORT_COLUMNS = [
  ...EXPORT_COLUMNS.VEHICLE,
  ...EXPORT_COLUMNS.CHARGE,
  ...EXPORT_COLUMNS.OTHER,
]

// Export presets
export const EXPORT_PRESETS = {
  all: {
    name: 'All columns',
    columns: ALL_EXPORT_COLUMNS.map((c) => c.key),
  },
  basic: {
    name: 'Basic info',
    columns: ['code', 'registration_plate', 'vehicle_type', 'status'],
  },
  financial: {
    name: 'Financial summary',
    columns: ['code', 'registration_plate', 'amount'],
  },
}