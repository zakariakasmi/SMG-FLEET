import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, Truck01, CurrencyDollar as Dollar } from '@untitledui/icons'
import { dashboardApi } from '../services/api'
import { formatCurrency, formatNumber, getVehicleTypeLabel } from '../utils/formatters'
import KpiCard from '../components/ui/KpiCard'
import Table from '../components/ui/Table'
import Skeleton from '../components/ui/Skeleton'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useYear } from '../context/YearContext'

const PAGE_SIZE = 10

function TableCard({ title, subtitle, columns, rows, empty, paginate }) {
  const [page, setPage] = useState(1)
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))

  const handlePageChange = (next) => {
    if (next >= 1 && next <= totalPages) setPage(next)
  }

  const visibleRows = paginate ? rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : rows

  return (
    <div className="p-6 rounded-lg border border-border bg-card shadow-sm">
      <h2 className="text-lg mb-1 text-foreground">{title}</h2>
      {subtitle && <p className="text-sm mb-4 text-muted-foreground">{subtitle}</p>}
      <Table
        columns={columns}
        data={visibleRows}
        emptyMessage={empty}
        pagination={paginate && totalPages > 1}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const { selectedYear } = useYear()
  const { showToast } = useToast()
  const { t } = useTranslation()
  const { can } = useAuth()

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear])

  const loadData = async () => {
    try {
      setLoading(true)
      const result = await dashboardApi.getDashboardData(selectedYear)
      setData(result)
    } catch (error) {
      showToast(t('dashboard.failedToLoad'), 'error')
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-7 w-40 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    )
  }

  const categories = data.categories || []
  const brands = data.brands || []
  const chargesByType = data.chargesByType || []
  const vehicleCharges = data.vehicleCharges || []
  const totalVehicles = data.totalVehicles || 0
  const grandTotal = data.grandTotal || 0
  const monthlyTotal = data.monthlyTotal || 0

  const typeName = (ct) => t(`chargeTypes.${ct.name}`, { defaultValue: ct.display_name })
  const catName = (name) => name || t('dashboard.uncategorized')

  const currencyCell = (value) => formatCurrency(value)

  const categoryColumns = [
    { key: 'name', label: t('columns.category'), render: (row) => catName(row.name) },
    { key: 'vehicles', label: t('dashboard.vehicles'), render: (row) => formatNumber(row.vehicles) },
    { key: 'totalCharges', label: t('columns.total'), render: (row) => currencyCell(row.totalCharges) },
    { key: 'monthly', label: t('dashboard.monthlyCharges'), render: (row) => currencyCell(row.monthly) },
  ]

  const brandColumns = [
    { key: 'brand', label: t('dashboard.brand'), render: (row) => row.brand || '—' },
    { key: 'vehicles', label: t('dashboard.vehicles'), render: (row) => formatNumber(row.vehicles) },
    { key: 'total', label: t('columns.total'), render: (row) => currencyCell(row.total) },
    { key: 'monthly', label: t('dashboard.monthlyCharges'), render: (row) => currencyCell(row.monthly) },
  ]

  const breakdownColumns = [
    { key: 'name', label: t('columns.chargeType'), render: (row) => typeName(row) },
    { key: 'vehicleCount', label: t('dashboard.vehicles'), render: (row) => formatNumber(row.vehicleCount) },
    { key: 'total', label: t('columns.total'), render: (row) => currencyCell(row.total) },
    { key: 'monthly', label: t('dashboard.monthlyCharges'), render: (row) => currencyCell(row.monthly) },
  ]

  const vehicleChargeColumns = [
    { key: 'code', label: t('columns.code'), render: (row) => row.code || '—' },
    { key: 'registration_plate', label: t('columns.registrationPlate'), render: (row) => row.registration_plate || '-' },
    { key: 'vehicle_type', label: t('columns.vehicleType'), render: (row) => getVehicleTypeLabel(row.vehicle_type) || '-' },
    { key: 'brand', label: t('columns.brand'), render: (row) => row.brand || '—' },
    { key: 'total', label: t('columns.total'), render: (row) => currencyCell(row.total) },
    { key: 'monthly', label: t('dashboard.monthlyCharges'), render: (row) => currencyCell(row.monthly) },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('dashboard.title')}</h1>
          <p className="text-sm mt-1 text-muted-foreground">
            {t('dashboard.subtitle')}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          title={t('dashboard.totalVehicles')}
          value={formatNumber(totalVehicles)}
          icon={Truck01}
          iconClassName="bg-primary/10 text-primary"
        />
        <KpiCard
          title={t('dashboard.totalCharges', { year: selectedYear })}
          value={formatCurrency(grandTotal)}
          icon={Dollar}
          iconClassName="bg-success/10 text-success"
        />
        <KpiCard
          title={t('dashboard.monthlyCharges')}
          value={formatCurrency(monthlyTotal)}
          icon={Calendar}
          iconClassName="bg-warning/10 text-warning"
        />
      </div>

      {/* Vehicles by Category */}
      <TableCard
        title={t('dashboard.vehiclesByCategory')}
        subtitle={t('dashboard.annualTotal', { year: selectedYear })}
        columns={categoryColumns}
        rows={categories}
        empty={t('dashboard.emptyVehicles')}
        paginate={false}
      />

      {/* Vehicles by Brand */}
      <TableCard
        title={t('dashboard.vehiclesByBrand')}
        subtitle={t('dashboard.annualTotal', { year: selectedYear })}
        columns={brandColumns}
        rows={brands}
        empty={t('dashboard.emptyBrands')}
        paginate={false}
      />

      {/* Charges Breakdown */}
      <TableCard
        title={t('dashboard.chargesBreakdown')}
        subtitle={t('dashboard.annualTotal', { year: selectedYear })}
        columns={breakdownColumns}
        rows={chargesByType}
        empty={t('dashboard.emptyCharges', { year: selectedYear })}
        paginate={false}
      />

      {/* Vehicle Charges */}
      <TableCard
        title={t('dashboard.vehicleCharges')}
        subtitle={t('dashboard.vehicleChargesSubtitle', { year: selectedYear })}
        columns={vehicleChargeColumns}
        rows={vehicleCharges}
        empty={t('dashboard.emptyCharges', { year: selectedYear })}
        paginate={vehicleCharges.length > 10}
      />

      {/* Getting Started */}
      {totalVehicles === 0 && (
        <div
          className="rounded-lg p-6 border border-primary/20 bg-primary/5"
        >
          <h3 className="text-lg mb-2 text-foreground">
            {t('dashboard.welcomeTitle')}
          </h3>
          <p className="mb-4 text-muted-foreground">
            {t('dashboard.welcomeDesc')}
          </p>
          <div className="flex gap-3">
            {can('addVehicles') && (
              <a
                href="/vehicles/new"
                className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold transition-colors hover:bg-primary/90"
              >
                {t('dashboard.addFirstVehicle')}
              </a>
            )}
            <a
              href="/import"
              className="inline-flex items-center px-4 py-2 rounded-md border border-primary text-primary font-semibold transition-colors hover:bg-primary/10"
            >
              {t('dashboard.importVehicles')}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}