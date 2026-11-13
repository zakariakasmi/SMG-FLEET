// Missions / travel-ledger export column definitions and shared constants.
// Keep the column keys in sync with MissionsList.jsx (the missions export) and
// GendarmerieExport.jsx.
//
// `label` is the sheet header, deliberately French (the source ledger is in
// French); `labelKey` is the i18n key for the column picker shown in the app.
//
// `scope` decides where a column can appear:
//   'mission' → one value per OM, repeated on every detailed row
//   'both'    → the mission's main vehicle in a summary, the line's own in a detail
//   'detail'  → per vehicle+driver values, only available in a detailed export
export const MISSION_EXPORT_COLUMNS = [
  { key: 'om', label: 'OM', labelKey: 'missions.colOm', scope: 'mission' },
  { key: 'date_depart', label: 'Date depart', labelKey: 'missions.colDate', scope: 'mission' },
  { key: 'depart', label: 'Depart', labelKey: 'missions.colDepart', scope: 'mission' },
  { key: 'destination', label: 'Destination', labelKey: 'missions.colDestination', scope: 'mission' },
  { key: 'a_travers', label: 'A travers', labelKey: 'missions.colVia', scope: 'mission' },
  { key: 'date_arriver', label: 'Date arriver', labelKey: 'missions.detailDateArriver', scope: 'mission' },
  { key: 'date_reglement', label: 'Date reglement', labelKey: 'missions.detailDateReglement', scope: 'mission' },
  { key: 'gendarmerie', label: 'Escorte gendarmerie', labelKey: 'missions.colGendarmerie', scope: 'mission' },
  { key: 'description', label: 'Description', labelKey: 'missions.colDescription', scope: 'mission' },
  { key: 'vehicles_count', label: 'Nb vehicules', labelKey: 'missions.detailVehiclesCount', scope: 'mission' },
  { key: 'drivers_count', label: 'Nb chauffeurs', labelKey: 'missions.colDriversCount', scope: 'mission' },
  { key: 'vehicle', label: 'Vehicule', labelKey: 'missions.colVehicle', scope: 'both' },
  { key: 'vehicle_type', label: 'Type de vehicule', labelKey: 'missions.colVehicleType', scope: 'both' },
  { key: 'driver', label: 'Chauffeur', labelKey: 'missions.colDriver', scope: 'both' },
  { key: 'line_no', label: 'Ligne', labelKey: 'missions.colLine', scope: 'detail' },
  { key: 'distance', label: 'Distance (km)', labelKey: 'missions.detailDistance', scope: 'detail' },
  { key: 'bordereau', label: 'Bordereau', labelKey: 'missions.detailBordereau', scope: 'detail' },
  { key: 'nature', label: 'Nature', labelKey: 'missions.detailNature', scope: 'detail' },
  { key: 'observation', label: 'Observation', labelKey: 'missions.detailObservation', scope: 'detail' },
  { key: 'expense_lines', label: 'Nb depenses', labelKey: 'missions.colExpenseLines', scope: 'detail' },
  { key: 'amount', label: 'Montant (MAD)', labelKey: 'missions.colAmount', scope: 'both' },
]

// Summary sheet: one row per OM (the historical column list, unchanged).
export const MISSION_SUMMARY_DEFAULT_KEYS = [
  'om',
  'date_depart',
  'depart',
  'destination',
  'a_travers',
  'date_arriver',
  'date_reglement',
  'vehicle',
  'vehicle_type',
  'driver',
  'description',
  'amount',
]

// Detailed sheet: one row per vehicle line and per driver. Repeats the mission
// header on every row so the sheet stays pivot-table friendly.
export const MISSION_DETAIL_DEFAULT_KEYS = [
  'om',
  'date_depart',
  'depart',
  'destination',
  'a_travers',
  'date_arriver',
  'date_reglement',
  'line_no',
  'vehicle',
  'vehicle_type',
  'driver',
  'distance',
  'bordereau',
  'observation',
  'expense_lines',
  'amount',
]

export const MISSION_COLUMNS = MISSION_SUMMARY_DEFAULT_KEYS.map((k) =>
  MISSION_EXPORT_COLUMNS.find((c) => c.key === k)
)

export const GENDARMERIE_COLUMNS = [
  { key: 'om', label: 'OM' },
  { key: 'date_depart', label: 'Date depart' },
  { key: 'depart', label: 'Depart' },
  { key: 'destination', label: 'Destination' },
  { key: 'vehicle', label: 'Vehicule' },
  { key: 'driver', label: 'Chauffeur' },
  { key: 'amount', label: 'Montant (MAD)' },
]

// Charge-level = only the gendarmerie-attributable categories (escort fees,
// moto essence, meals). Mission-level = every line of the OM.
// Codes come from `expense_categories` (spec §9 + §8.2).
export const GENDARMERIE_CHARGE_CATEGORIES = ['escorte_gendarmerie', 'gasoil', 'repas']

export const GENDARMERIE_LEVELS = ['charge', 'mission']
