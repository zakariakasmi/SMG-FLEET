export const MONTHLY_DIVISOR_FALLBACK = 12

const CHRONO_TACHYGRAPHE_MONTHS = 24
const VISITE_TECHNIQUE_MINIBUS_MONTHS = 6

export function getChargeMonths(chargeTypeName: string | null | undefined, vehicleType: string | null | undefined): number {
  const name = String(chargeTypeName || '').toLowerCase()
  if (name === 'chrono_tachygraphe') return CHRONO_TACHYGRAPHE_MONTHS
  if (name === 'visite_technique' && String(vehicleType || '').toLowerCase() === 'minibus') return VISITE_TECHNIQUE_MINIBUS_MONTHS
  return MONTHLY_DIVISOR_FALLBACK
}

export function monthlyAmount(amount: number | string | null | undefined, chargeTypeName: string | null | undefined, vehicleType: string | null | undefined): number {
  const value = Number(amount) || 0
  const months = getChargeMonths(chargeTypeName, vehicleType)
  return Math.round((value / months) * 100) / 100
}

export interface ChargeLike {
  amount?: number | string | null
  charge_type?: { name?: string | null; display_name?: string | null } | null
  vehicle?: { vehicle_type?: string | null } | null
}

export function getChargeName(charge: ChargeLike | null | undefined): string {
  return charge?.charge_type?.display_name || charge?.charge_type?.name || ''
}

export function getChargeTypeName(charge: ChargeLike | null | undefined): string {
  return charge?.charge_type?.name || ''
}

export function getChargeVehicleType(charge: ChargeLike | null | undefined): string {
  return charge?.vehicle?.vehicle_type || ''
}

export function vehicleAnnualTotal(charges: ChargeLike[] = []): number {
  return charges.reduce((sum, ch) => sum + (Number(ch.amount) || 0), 0)
}

export function vehicleMonthlyTotal(vehicle: { vehicle_type?: string | null } | null | undefined, charges: ChargeLike[] = []): number {
  const fallbackType = vehicle?.vehicle_type || ''
  return charges.reduce((sum, ch) => {
    const name = getChargeTypeName(ch)
    const vehicleType = ch?.vehicle?.vehicle_type || fallbackType
    return sum + monthlyAmount(ch.amount, name, vehicleType)
  }, 0)
}