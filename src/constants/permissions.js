export const PERMISSION_SCOPES = [
  { key: 'vehicles', labelKey: 'settings.permVehicles' },
  { key: 'addVehicles', labelKey: 'settings.permAddVehicles' },
  { key: 'editVehicles', labelKey: 'settings.permEditVehicles' },
  { key: 'deleteVehicles', labelKey: 'settings.permDeleteVehicles' },
  { key: 'charges', labelKey: 'settings.permCharges' },
  { key: 'addCharges', labelKey: 'settings.permAddCharges' },
  { key: 'editCharges', labelKey: 'settings.permEditCharges' },
  { key: 'deleteCharges', labelKey: 'settings.permDeleteCharges' },
  { key: 'import', labelKey: 'settings.permImport' },
  { key: 'export', labelKey: 'settings.permExport' },
  { key: 'manageTypes', labelKey: 'settings.permManageTypes' },
  { key: 'missions', labelKey: 'settings.permMissions' },
  { key: 'addMissions', labelKey: 'settings.permAddMissions' },
  { key: 'editMissions', labelKey: 'settings.permEditMissions' },
  { key: 'deleteMissions', labelKey: 'settings.permDeleteMissions' },
  // Operations book: the tachograph operations themselves.
  { key: 'tachograph', labelKey: 'settings.permTachograph' },
  { key: 'addTachograph', labelKey: 'settings.permAddTachograph' },
  { key: 'editTachograph', labelKey: 'settings.permEditTachograph' },
  { key: 'deleteTachograph', labelKey: 'settings.permDeleteTachograph' },
  // Demand book: a requester only sends demands and never sees an operation.
  // `addTachographDemands` covers sending, correcting and withdrawing their own
  // demands; `viewAllTachographDemands` is the fleet-manager role that sees
  // every demand instead of only the ones they raised.
  { key: 'tachographDemands', labelKey: 'settings.permTachographDemands' },
  { key: 'addTachographDemands', labelKey: 'settings.permAddTachographDemands' },
  { key: 'viewAllTachographDemands', labelKey: 'settings.permViewAllTachographDemands' },
]

export const ALL_PERMISSION_KEYS = PERMISSION_SCOPES.map((s) => s.key)

export const PERMISSION_LABELS = Object.fromEntries(
  PERMISSION_SCOPES.map((s) => [s.key, s.labelKey]),
)

// How the scopes are laid out in Settings → Users and in the add-user form.
// Every scope in PERMISSION_SCOPES must appear in exactly one group: a scope
// that is in no group cannot be granted from the UI at all.
export const PERMISSION_GROUPS = [
  {
    labelKey: 'settings.permVehicles',
    keys: ['vehicles', 'addVehicles', 'editVehicles', 'deleteVehicles'],
  },
  {
    labelKey: 'settings.permCharges',
    keys: ['charges', 'addCharges', 'editCharges', 'deleteCharges'],
  },
  {
    labelKey: 'settings.permMissions',
    keys: ['missions', 'addMissions', 'editMissions', 'deleteMissions'],
  },
  {
    labelKey: 'settings.permGroupTachographOperations',
    keys: ['tachograph', 'addTachograph', 'editTachograph', 'deleteTachograph'],
  },
  {
    labelKey: 'settings.permGroupDemands',
    keys: ['tachographDemands', 'addTachographDemands', 'viewAllTachographDemands'],
  },
  {
    labelKey: 'settings.permGroupData',
    keys: ['import', 'export', 'manageTypes'],
  },
]

// Scopes that open the demand book. Operations users see it too: it is where a
// demand is turned into an operation. Holding the send scope alone is enough —
// being able to raise a demand implies being able to reach the demand book.
export const DEMAND_ACCESS_SCOPES = [
  'tachographDemands',
  'addTachographDemands',
  'tachograph',
  'viewAllTachographDemands',
]

// Granted to every signed-in user without an explicit tick. The tachograph
// module is NOT here: operations must be granted, a requester gets only the
// demand book.
export const READ_ONLY_SCOPES = ['vehicles', 'charges', 'export']
