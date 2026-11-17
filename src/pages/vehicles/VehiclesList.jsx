import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Upload01 as Upload, Download01 as Download, Eye, FilterFunnel01 as SlidersHorizontal, Truck01 as Truck } from '@untitledui/icons'
import { useTranslation } from 'react-i18next'
import { vehiclesApi, categoriesApi } from '../../services/api'
import { formatNumber, formatCurrency, getStatusBadge, getVehicleTypeLabel } from '../../utils/formatters'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Table from '../../components/ui/Table'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { useAuth } from '../../context/AuthContext'
import { useYear } from '../../context/YearContext'
import VehicleDrawer from '../../components/vehicles/VehicleDrawer'

const SF = { strokeWidth: 1.75, fill: 'none' }
const PAGE_SIZE = 10

const listCache = { key: '', vehicles: [], total: 0 }
const listScroll = { saved: null }
const makeListKey = (p) =>
  JSON.stringify([p.year, p.search, p.status, p.type, p.brand, p.category, p.hp, p.tonnage, p.sort, p.dir, p.page])

export default function VehiclesList() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const { selectedYear } = useYear()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestSeq = useRef(0)

  const liveSearch = searchParams.get('search') || ''
  const statusFilter = searchParams.get('status') || ''
  const typeFilter = searchParams.get('type') || ''
  const brandFilter = searchParams.get('brand') || ''
  const categoryFilter = searchParams.get('category') || ''
  const hpFilter = searchParams.get('hp') || ''
  const tonnageFilter = searchParams.get('tonnage') || ''
  const canViewCharges = can('charges')
  const rawSortBy = searchParams.get('sort') || 'code'
  const sortBy = !canViewCharges && rawSortBy === 'total_charges' ? 'code' : rawSortBy
  const sortDir = searchParams.get('dir') || 'asc'
  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const listKey = makeListKey({
    year: selectedYear,
    search: liveSearch,
    status: statusFilter,
    type: typeFilter,
    brand: brandFilter,
    category: categoryFilter,
    hp: hpFilter,
    tonnage: tonnageFilter,
    sort: sortBy,
    dir: sortDir,
    page: currentPage,
  })
  const cachedSnapshot = listCache.key === listKey ? listCache : null
  const hasCached = Boolean(cachedSnapshot)

  const [vehicles, setVehicles] = useState(hasCached ? cachedSnapshot.vehicles : [])
  const [total, setTotal] = useState(hasCached ? cachedSnapshot.total : 0)
  const [loading, setLoading] = useState(!hasCached)
  const [error, setError] = useState(false)
  const [categories, setCategories] = useState([])
  const [typeOptions, setTypeOptions] = useState([])
  const [brandOptions, setBrandOptions] = useState([])
  const [drawerVehicle, setDrawerVehicle] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
    })
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    categoriesApi
      .list()
      .then((data) => setCategories(data || []))
      .catch((err) => console.error('Error loading categories:', err))
  }, [])

  useEffect(() => {
    vehiclesApi
      .listOptions()
      .then((opts) => {
        setTypeOptions(opts.types || [])
        setBrandOptions(opts.brands || [])
      })
      .catch((err) => console.error('Error loading filter options:', err))
  }, [])

  useEffect(() => {
    const seq = ++requestSeq.current
    const key = makeListKey({
      year: selectedYear,
      search: liveSearch,
      status: statusFilter,
      type: typeFilter,
      brand: brandFilter,
      category: categoryFilter,
      hp: hpFilter,
      tonnage: tonnageFilter,
      sort: sortBy,
      dir: sortDir,
      page: currentPage,
    })
    const snap = listCache.key === key ? listCache : null
    if (!snap) {
      setLoading(true)
      setError(false)
    }
    const filters = {
      year: selectedYear,
      search: liveSearch,
      status: statusFilter,
      type: typeFilter,
      brand: brandFilter,
      categoryId: categoryFilter,
      hp: hpFilter,
      tonnage: tonnageFilter,
      sortBy,
      sortDir,
      page: currentPage,
      pageSize: PAGE_SIZE,
    }
    vehiclesApi
      .search(filters)
      .then(({ data, count }) => {
        if (seq !== requestSeq.current) return
        listCache.key = key
        listCache.vehicles = data || []
        listCache.total = count || 0
        setVehicles(data || [])
        setTotal(count || 0)
        if (count > 0 && Math.ceil(count / PAGE_SIZE) < currentPage) {
          updateParams({ page: '' })
        }
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return
        console.error('Error loading vehicles:', err)
        if (!snap) {
          setError(true)
          setVehicles([])
          setTotal(0)
        }
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false)
      })
  }, [liveSearch, statusFilter, typeFilter, brandFilter, categoryFilter, hpFilter, tonnageFilter, sortBy, sortDir, currentPage, retryKey, refreshKey, selectedYear])

  useEffect(() => {
    const main = document.querySelector('main')
    const onScroll = () => {
      if (main) listScroll.saved = main.scrollTop
    }
    if (main) main.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (main) main.removeEventListener('scroll', onScroll)
    }
  }, [])

  const scrollTargetRef = useRef(null)

  useEffect(() => {
    if (listScroll.saved == null) return
    scrollTargetRef.current = listScroll.saved
    const main = document.querySelector('main')
    if (!main) return
    requestAnimationFrame(() => {
      main.scrollTop = scrollTargetRef.current
    })
  }, [])

  useEffect(() => {
    if (loading) return
    const main = document.querySelector('main')
    if (!main || scrollTargetRef.current == null) return
    const target = scrollTargetRef.current
    scrollTargetRef.current = null
    requestAnimationFrame(() => {
      main.scrollTop = target
    })
  }, [loading])

  const hasActiveFilters = Boolean(
    liveSearch || statusFilter || typeFilter || brandFilter || categoryFilter || hpFilter || tonnageFilter
  )

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)

  const toggleSort = (columnKey) => {
    if (sortBy === columnKey) {
      updateParams({ dir: sortDir === 'asc' ? 'desc' : 'asc', page: '' })
    } else {
      updateParams({ sort: columnKey, dir: 'asc', page: '' })
    }
  }

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return
    updateParams({ page: page > 1 ? String(page) : '' })
  }

  const openDrawer = (vehicle) => {
    setDrawerVehicle(vehicle)
    setDrawerOpen(true)
  }

  const columns = [
    {
      key: 'code',
      label: t('vehicles.code'),
      sortable: true,
      render: (row) => (
        <span className="font-medium text-primary">{row.code}</span>
      ),
    },
    {
      key: 'registration_plate',
      label: t('vehicles.regPlate'),
      sortable: true,
    },
    {
      key: 'ww_plate',
      label: t('vehicles.wwPlate'),
      sortable: true,
      render: (row) => row.ww_plate || '-',
    },
    {
      key: 'vehicle_type',
      label: t('vehicles.vehicleType'),
      sortable: true,
      render: (row) => getVehicleTypeLabel(row.vehicle_type),
    },
    {
      key: 'brand',
      label: t('vehicles.brand'),
      sortable: true,
    },
    {
      key: 'category_name',
      label: t('vehicles.category'),
      sortable: true,
      render: (row) => row.category_name || '-',
    },
    {
      key: 'puissance_fiscale',
      label: t('vehicles.puissanceFiscale'),
      sortable: true,
      render: (row) => formatNumber(row.puissance_fiscale),
    },
    {
      key: 'ptac',
      label: t('vehicles.ptac'),
      sortable: true,
      render: (row) => formatNumber(row.ptac),
    },
    ...(canViewCharges
      ? [
          {
            key: 'total_charges',
            label: t('vehicles.annualCharges'),
            sortable: true,
            render: (row) => formatCurrency(row.total_charges),
          },
        ]
      : []),
    {
      key: 'status',
      label: t('common.status'),
      render: (row) => {
        const badge = getStatusBadge(row.status)
        return (
          <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${badge.className}`}>
            {badge.label}
          </span>
        )
      },
    },
    {
      key: 'view',
      label: t('vehicles.view'),
      render: (row) => (
        <span
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/vehicles/${row.code}`)
          }}
        >
          <Eye {...SF} className="w-4 h-4" />
          {t('common.view')}
        </span>
      ),
    },
  ]

  let body
  if (!loading && error) {
    body = (
      <div className="rounded-md p-4 border border-border bg-card">
        <ErrorState
          title={t('vehicles.failedToLoad')}
          description={t('ui.errorLoadDesc')}
          onRetry={() => setRetryKey((k) => k + 1)}
        />
      </div>
    )
  } else if (!loading && total === 0 && !hasActiveFilters) {
    body = (
      <EmptyState
        title={t('vehicles.noVehiclesFound')}
        description={t('vehicles.noVehiclesDesc')}
        action={
          <div className="flex gap-2">
            {can('addVehicles') && (
              <Button onClick={() => navigate('/vehicles/new')}>
                {t('vehicles.addVehicle')}
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/import')}>
              {t('common.import')}
            </Button>
          </div>
        }
      />
    )
  } else {
    body = (
      <Table
        columns={columns}
        data={vehicles}
        loading={loading}
        skeletonRows={6}
        onRowClick={openDrawer}
        selectedRowKey={drawerOpen ? drawerVehicle?.id : null}
        getRowKey={(row) => row.id}
        pagination={total > PAGE_SIZE}
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        sortColumn={sortBy}
        sortDirection={sortDir}
        onSortChange={toggleSort}
        emptyMessage={hasActiveFilters ? t('vehicles.noVehiclesSearch') : t('ui.noData')}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary"
          >
            <Truck {...SF} className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('vehicles.title')}</h1>
            <p className="text-sm mt-0.5 text-muted-foreground">{t('vehicles.subtitle')}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/import')}>
            <Upload {...SF} className="w-4 h-4 mr-2" />
            {t('common.import')}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/export')}>
            <Download {...SF} className="w-4 h-4 mr-2" />
            {t('common.export')}
          </Button>
          {can('addVehicles') && (
            <Button onClick={() => navigate('/vehicles/new')}>
              <Plus {...SF} className="w-4 h-4 mr-2" />
              {t('vehicles.addVehicle')}
            </Button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="rounded-lg p-4 border border-border bg-card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder={t('vehicles.searchPlaceholder')}
              value={liveSearch}
              onChange={(e) => updateParams({ search: e.target.value, page: '' })}
            />
          </div>
          <div className="sm:w-44">
            <Select
              value={statusFilter}
              onChange={(e) => updateParams({ status: e.target.value, page: '' })}
              options={[
                { value: 'active', label: t('common.active') },
                { value: 'sold', label: t('common.sold') },
              ]}
              placeholder={t('common.status')}
              showAll
              allLabel={t('common.all')}
            />
          </div>
          <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal {...SF} className="w-4 h-4 mr-2" />
            {t('common.filters')}
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border">
            <Select
              value={typeFilter}
              onChange={(e) => updateParams({ type: e.target.value, page: '' })}
              options={typeOptions.map((type) => ({ value: type, label: getVehicleTypeLabel(type) }))}
              placeholder={t('vehicles.vehicleType')}
              showAll
              allLabel={t('common.all')}
            />
            <Select
              value={brandFilter}
              onChange={(e) => updateParams({ brand: e.target.value, page: '' })}
              options={brandOptions.map((brand) => ({ value: brand, label: brand }))}
              placeholder={t('vehicles.brand')}
              showAll
              allLabel={t('common.all')}
            />
            <Select
              value={categoryFilter}
              onChange={(e) => updateParams({ category: e.target.value, page: '' })}
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
              placeholder={t('vehicles.category')}
              showAll
              allLabel={t('common.all')}
            />
            <Input
              type="number"
              placeholder={t('vehicles.puissanceFiscale')}
              value={hpFilter}
              onChange={(e) => updateParams({ hp: e.target.value, page: '' })}
            />
            <Input
              type="number"
              placeholder={t('vehicles.ptac')}
              value={tonnageFilter}
              onChange={(e) => updateParams({ tonnage: e.target.value, page: '' })}
            />
          </div>
        )}
      </div>

      {/* Table */}
      {body}

      {/* Detail Drawer */}
      <VehicleDrawer
        vehicle={drawerVehicle}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setDrawerVehicle(null)
        }}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}