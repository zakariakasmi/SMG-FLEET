// Shared helpers for the tachograph module (dates and labels).

const pad = (n) => String(n).padStart(2, '0')

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayISO() {
  return toISODate(new Date())
}

// Calendar-month arithmetic that clamps end-of-month (31 Jan + 1 month → 28/29 Feb).
export function addMonthsISO(iso, months) {
  if (!iso || !months) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const targetDay = date.getDate()
  date.setMonth(date.getMonth() + Number(months))
  if (date.getDate() < targetDay) date.setDate(0)
  return toISODate(date)
}

// Negative = overdue, 0 = due today, positive = days remaining.
export function daysUntil(iso) {
  if (!iso) return null
  const today = new Date(`${todayISO()}T00:00:00`)
  const target = new Date(`${iso}T00:00:00`)
  if (isNaN(target.getTime())) return null
  return Math.round((target - today) / 86400000)
}

// The next revision date implied by an operation type's interval.
export function nextDueFrom(performedOn, operationType) {
  const months = operationType?.default_interval_months
  if (!performedOn || !months) return ''
  return addMonthsISO(performedOn, months)
}

// Operation names are bilingual in the DB; pick the active UI language.
export function operationTypeLabel(type, language) {
  if (!type) return ''
  if (String(language || 'fr').startsWith('en')) {
    return type.name_en || type.name_fr || type.code || ''
  }
  return type.name_fr || type.name_en || type.code || ''
}
