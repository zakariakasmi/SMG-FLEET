// Charge type definitions matching the database
export const CHARGE_TYPES = {
  VISITE_TECHNIQUE: {
    id: 1,
    name: 'visite_technique',
    displayName: 'Visite technique',
    frequency: '12_months',
    dueDateType: 'variable',
  },
  TAXE_TRANSPORT: {
    id: 2,
    name: 'taxe_transport',
    displayName: 'Taxe transport',
    frequency: 'annual',
    dueDateType: 'fixed',
  },
  TAXE_ESSIEU: {
    id: 3,
    name: 'taxe_essieu',
    displayName: "Taxe à l'essieu",
    frequency: 'annual',
    dueDateType: 'fixed',
  },
  CHRONO_TACHYGRAPHE: {
    id: 4,
    name: 'chrono_tachygraphe',
    displayName: 'Chrono tachygraphe',
    frequency: '24_months',
    dueDateType: 'variable',
  },
  ASSURANCE: {
    id: 5,
    name: 'assurance',
    displayName: 'Assurance',
    frequency: 'annual',
    dueDateType: 'fixed',
  },
}

export const CHARGE_TYPE_LIST = Object.values(CHARGE_TYPES)

export const getChargeTypeById = (id) => {
  return CHARGE_TYPE_LIST.find((ct) => ct.id === id) || null
}

export const getChargeTypeByName = (name) => {
  return CHARGE_TYPE_LIST.find((ct) => ct.name === name) || null
}