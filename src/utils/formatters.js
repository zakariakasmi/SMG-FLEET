import i18n from '../i18n'

const t = i18n.t.bind(i18n)

export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0 MAD'
  }
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) {
    return '0'
  }
  return new Intl.NumberFormat('fr-MA').format(num)
}

export function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return t('common.today')
  if (diffDays === 1) return t('common.yesterday')
  if (diffDays < 7) return t('common.daysAgo', { count: diffDays })
  if (diffDays < 30) return t('common.weeksAgo', { count: Math.floor(diffDays / 7) })
  if (diffDays < 365) return t('common.monthsAgo', { count: Math.floor(diffDays / 30) })
  return t('common.yearsAgo', { count: Math.floor(diffDays / 365) })
}

export function getStatusBadge(status) {
  const badges = {
    active: {
      className: 'bg-success/10 text-success',
      label: t('common.active'),
    },
    sold: {
      className: 'bg-gray-200 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
      label: t('common.sold'),
    },
  }
  return badges[status] || { className: 'bg-gray-200 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300', label: status }
}

export function getVehicleTypeLabel(type) {
  const labels = {
    camion: t('vehicleTypes.camion'),
    minibus: t('vehicleTypes.minibus'),
    van: t('vehicleTypes.van'),
    pickup: t('vehicleTypes.pickup'),
    tracteur: t('vehicleTypes.tracteur'),
  }
  return labels[type] || type
}

export function getFuelTypeLabel(type) {
  const labels = {
    Diesel: t('fuelTypes.Diesel'),
    Essence: t('fuelTypes.Essence'),
    Electric: t('fuelTypes.Electric'),
    Gas: t('fuelTypes.Gas'),
    Hybrid: t('fuelTypes.Hybrid'),
  }
  return labels[type] || type
}
