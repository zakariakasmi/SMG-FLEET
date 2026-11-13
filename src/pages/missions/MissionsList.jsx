import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Route as RouteIcon,
  Download01 as Download,
  AlertTriangle,
  File01,
  Users01,
  Tag01,
  Plus,
  Columns01,
  CheckSquare,
  Square,
} from '@untitledui/icons'
import { missionsApi } from '../../services/api'
import {
  missionVehicleChip,
  vehicleChip,
  missionDriver,
  missionVehicleType,
  missionDescription,
  missionAmount,
  driverMissionAmount,
  driverMissionLabels,
  driverMatchesRow,
  missionRowDriver,
  missionVehicleLines,
  lineField,
  missionHasNeedsReview,
  missionHasUnknownVehicle,
  routeLabel,
} from '../../utils/missions'
import { formatDate } from '../../utils/formatters'
import { generateExportFilename, downloadFile, generateCSV, generateExcel, generatePDF } from '../../utils/parsers'
import {
  MISSION_EXPORT_COLUMNS,
  MISSION_SUMMARY_DEFAULT_KEYS,
  MISSION_DETAIL_DEFAULT_KEYS,
} from '../../constants/missionExportColumns'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import MissionFilters from '../../components/missions/MissionFilters'
import ReviewTreatmentModal from '../../components/missions/ReviewTreatmentModal'

const SF = { strokeWidth: 1.75, fill: 'none' }
const PAGE_SIZE = 15

const pad2 = (n) => String(n).padStart(2, '0')

// Default list window: the current calendar month. The list loads only this window
// from the DB; older dates are fetched on demand by changing From/To — or by
// searching, which deliberately spans all dates (see MissionsList).
function currentMonthRange(date = new Date()) {
  const y = date.getFullYear()
  const m = date.getMonth()
  const lastDay = new Date(y, m + 1, 0).getDate()
  return { from: `${y}-${pad2(m + 1)}-01`, to: `${y}-${pad2(m + 1)}-${pad2(lastDay)}` }
}

const money2 = (n) =>
  (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Sort keys for the list. Amount / driver / vehicle are derived, so a plain field
// sort is not enough.
const SORT_ACCESSORS = {
  om: (m) => m.om || '',
  date_depart: (m) => m.date_depart || '',
  vehicle: (m) => missionVehicleChip(m).label.toLowerCase(),
  vehicle_type: (m) => missionVehicleType(m).toLowerCase(),
  driver: (m) => missionDriver(m).toLowerCase(),
  description: (m) => missionDescription(m).toLowerCase(),
  amount: (m) => missionAmount(m),
}

function Chip({ kind, children }) {
  const styles = {
    fleet: 'bg-primary/10 text-primary',
    ledger: 'bg-warning/10 text-warning',
    unknown: 'bg-destructive/10 text-destructive',
    none: 'bg-muted text-muted-foreground',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${styles[kind] || styles.none}`}>
      {children}
    </span>
  )
}

export default function MissionsList() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const canTreat = can('import')
  const canCreate = can('addMissions')

  const filters = {
    search: searchParams.get('search') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    vehicle: searchParams.get('vehicle') || '',
    driver: searchParams.get('driver') || '',
    gendarmerie: searchParams.get('gend') === '1',
    needsReview: searchParams.get('review') === '1',
    unknownVehicle: searchParams.get('unknown') === '1',
  }

  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [page, setPage] = useState(1)
  const [reviewTab, setReviewTab] = useState('lines')
  const [reviewKey, setReviewKey] = useState(0)
  const [treat, setTreat] = useState(null)
  const [exportFormat, setExportFormat] = useState('xlsx')
  const [exportMode, setExportMode] = useState('summary')
  const [exportColumns, setExportColumns] = useState(MISSION_SUMMARY_DEFAULT_KEYS)
  const [showExportColumns, setShowExportColumns] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [debounced, setDebounced] = useState({ search: filters.search, vehicle: filters.vehicle, driver: filters.driver })
  const [sort, setSort] = useState({ key: 'date_depart', dir: 'desc' })
  const [reviewData, setReviewData] = useState({ lines: [], unknown: [], dismissals: [] })

  const isSearching = debounced.search.trim() !== ''
  const defaultRange = useMemo(() => currentMonthRange(), [])

  // Search, vehicle and driver all query the DB, so they span the whole ledger and
  // shed the current-month default (unless the user pinned From/To) — otherwise a
  // filter would silently miss older missions.
  const isBroad = isSearching || debounced.vehicle.trim() !== '' || debounced.driver.trim() !== ''
  const queryFrom = isBroad ? filters.from || '' : filters.from || defaultRange.from
  const queryTo = isBroad ? filters.to || '' : filters.to || defaultRange.to

  // Filtering by a driver reports that driver's own expenses — the ledger keeps
  // one `mission_vehicles` row per vehicle+driver, each carrying its own
  // expenses — instead of the whole mission's total.
  const driverQuery = debounced.driver.trim()
  const amountOf = useCallback(
    (m) => (driverQuery ? driverMissionAmount(m, driverQuery) : missionAmount(m)),
    [driverQuery]
  )

  const updateFilters = (patch) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([key, value]) => {
      const paramKey =
        key === 'gendarmerie' ? 'gend' : key === 'needsReview' ? 'review' : key === 'unknownVehicle' ? 'unknown' : key
      if (value === true) next.set(paramKey, '1')
      else if (value === false || value === '') next.delete(paramKey)
      else next.set(paramKey, value)
    })
    setSearchParams(next, { replace: true })
  }

  const resetFilters = () => setSearchParams(new URLSearchParams(), { replace: true })

  useEffect(() => {
    const id = setTimeout(
      () => setDebounced({ search: filters.search, vehicle: filters.vehicle, driver: filters.driver }),
      300
    )
    return () => clearTimeout(id)
  }, [filters.search, filters.vehicle, filters.driver])

  // Date range + search + vehicle + driver hit the database so older missions are
  // queried on demand instead of loading the whole ledger up front.
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    setPage(1)
    missionsApi
      .list({
        search: debounced.search.trim(),
        from: queryFrom || undefined,
        to: queryTo || undefined,
        gendarmerie: filters.gendarmerie,
        vehicle: debounced.vehicle.trim(),
        driver: debounced.driver.trim(),
      })
      .then((data) => {
        if (active) setMissions(data || [])
      })
      .catch((err) => {
        console.error('Error loading missions:', err)
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [debounced, queryFrom, queryTo, filters.gendarmerie, retryKey])

  // Review queues are ledger-wide (not scoped to the loaded month); a dedicated,
  // lightweight query keeps them complete without loading every mission.
  useEffect(() => {
    let active = true
    missionsApi
      .reviewQueues()
      .then((d) => {
        if (active) setReviewData(d)
      })
      .catch((err) => console.error('Error loading review queues:', err))
    return () => {
      active = false
    }
  }, [reviewKey])

  // Search, date range, gendarmerie, vehicle and driver are handled server-side;
  // only the filters that need nested row data stay client-side.
  const filtered = useMemo(() => {
    return missions.filter((m) => {
      if (filters.needsReview && !missionHasNeedsReview(m)) return false
      if (filters.unknownVehicle && !missionHasUnknownVehicle(m)) return false
      return true
    })
  }, [missions, filters.needsReview, filters.unknownVehicle])

  const sorted = useMemo(() => {
    const acc = sort.key === 'amount' ? amountOf : SORT_ACCESSORS[sort.key]
    if (!acc) return filtered
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = acc(a)
      const bv = acc(b)
      if (av > bv) return dir
      if (av < bv) return -dir
      return 0
    })
  }, [filtered, sort, amountOf])

  const kpis = useMemo(() => {
    let total = 0
    let reviewLines = 0
    for (const m of filtered) {
      total += amountOf(m)
      for (const mv of m.mission_vehicles || []) {
        for (const e of mv.mission_expenses || []) if (e.needs_review) reviewLines += 1
      }
    }
    return { missions: filtered.length, total, reviewLines }
  }, [filtered, amountOf])

  const reviewQueues = useMemo(() => {
    const lines = (reviewData.lines || []).map((e) => {
      const mv = e.mission_vehicle
      const m = mv?.mission
      return {
        key: `${mv?.id}-${e.id}`,
        missionId: m?.id,
        om: m?.om || '',
        date: m?.date_depart,
        column: e.source_column,
        label: e.parsed_label,
        amount: e.amount,
        category: e.expense_category?.name_fr || e.expense_category?.code || '',
        raw: e,
      }
    })
    const unknown = (reviewData.unknown || []).map((mv) => {
      const m = mv.mission
      return {
        key: `${m?.id}-${mv.id}`,
        missionId: m?.id,
        om: m?.om || '',
        date: m?.date_depart,
        type: mv.vehicle_type_raw,
        label: mv.vehicle_label,
        raw: mv,
      }
    })
    return { lines, unknown }
  }, [reviewData])

  useEffect(() => {
    setPage(1)
  }, [filters.search, filters.from, filters.to, filters.vehicle, filters.driver, filters.gendarmerie, filters.needsReview, filters.unknownVehicle, sort])

  const rangeLabel =
    !filters.from && !filters.to && isBroad ? t('missions.allDates') : `${queryFrom || '…'} → ${queryTo || '…'}`

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage]
  )

  // Columns offered by the picker: the detailed-only ones (distance, bordereau,
  // per-line driver…) make no sense on a one-row-per-OM summary.
  const availableExportColumns = useMemo(
    () => MISSION_EXPORT_COLUMNS.filter((c) => exportMode === 'detailed' || c.scope !== 'detail'),
    [exportMode]
  )

  const exportColumnsSpec = useMemo(() => {
    const selected = new Set(exportColumns)
    return availableExportColumns
      .filter((c) => selected.has(c.key))
      .map((c) => ({
        key: c.key,
        // Filtering by a driver turns the summary amount into that driver's own
        // expenses, so its header is renamed to match.
        label:
          c.key === 'amount' && driverQuery && exportMode === 'summary'
            ? t('missions.colAmountDriver')
            : c.label,
      }))
  }, [availableExportColumns, exportColumns, driverQuery, exportMode, t])

  const toggleExportColumn = (key) =>
    setExportColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const changeExportMode = (mode) => {
    if (mode === exportMode) return
    setExportMode(mode)
    setExportColumns(mode === 'detailed' ? MISSION_DETAIL_DEFAULT_KEYS : MISSION_SUMMARY_DEFAULT_KEYS)
  }

  // One export row per OM. The vehicle/driver are the mission's *main* one and
  // the amount is the whole mission: nothing here repeats a mission across rows.
  const summaryExportRow = (m) => ({
    om: m.om,
    date_depart: m.date_depart ? String(m.date_depart).slice(0, 10) : '',
    depart: m.depart || '',
    destination: m.destination || '',
    a_travers: m.a_travers || '',
    date_arriver: m.date_arriver ? String(m.date_arriver).slice(0, 10) : '',
    date_reglement: m.date_reglement ? String(m.date_reglement).slice(0, 10) : '',
    gendarmerie: m.gendarmerie_required ? t('missions.yes') : t('missions.no'),
    description: missionDescription(m),
    vehicles_count: missionVehicleLines(m).length,
    drivers_count: (m.mission_vehicles || []).length,
    vehicle: missionVehicleChip(m).label,
    vehicle_type: missionVehicleType(m),
    driver: driverQuery ? driverMissionLabels(m, driverQuery).join(', ') || driverQuery : missionDriver(m),
    amount: amountOf(m),
  })

  // Detail rows: every vehicle line, and every driver of a line, gets its own
  // row carrying that driver's own expenses — so a mission with several vehicles
  // or several drivers is never collapsed into a single OM total. Mission-level
  // values repeat on each row to keep the sheet pivot-friendly. When a driver
  // filter is active only that driver's rows are exported.
  const detailedExportRows = (m) => {
    const lines = missionVehicleLines(m)
    const header = {
      om: m.om,
      date_depart: m.date_depart ? String(m.date_depart).slice(0, 10) : '',
      depart: m.depart || '',
      destination: m.destination || '',
      a_travers: m.a_travers || '',
      date_arriver: m.date_arriver ? String(m.date_arriver).slice(0, 10) : '',
      date_reglement: m.date_reglement ? String(m.date_reglement).slice(0, 10) : '',
      gendarmerie: m.gendarmerie_required ? t('missions.yes') : t('missions.no'),
      description: missionDescription(m),
      vehicles_count: lines.length,
      drivers_count: (m.mission_vehicles || []).length,
    }
    const rows = []
    lines.forEach((line, i) => {
      const first = line.rows[0]
      const vehicle = vehicleChip(first).label
      // Type/observation are often written on only one row of the group.
      const vehicleType = lineField(line, (mv) => mv.category?.name || mv.vehicle_type_raw) || ''
      for (const mv of line.rows) {
        const driver = missionRowDriver(mv)
        if (driverQuery && !driverMatchesRow(mv, driverQuery)) continue
        const expenses = mv.mission_expenses || []
        rows.push({
          ...header,
          line_no: i + 1,
          vehicle,
          vehicle_type: vehicleType,
          driver,
          distance: mv.distance ?? '',
          bordereau: mv.bordereau || '',
          nature: mv.nature_de_charge || '',
          observation: mv.observation || '',
          expense_lines: expenses.length,
          amount: expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
        })
      }
    })
    return rows
  }

  const exportRows = useMemo(
    () => (exportMode === 'detailed' ? sorted.flatMap(detailedExportRows) : sorted.map(summaryExportRow)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sorted, exportMode, driverQuery]
  )

  const handleExport = () => {
    if (exportRows.length === 0) {
      showToast(t('missions.nothingToExport'), 'warning')
      return
    }
    if (exportColumnsSpec.length === 0) {
      showToast(t('missions.exportNoColumns'), 'warning')
      return
    }
    try {
      setExporting(true)
      const cols = exportColumnsSpec
      const data = exportRows
      const filename = generateExportFilename(`SMG-Missions-${exportMode}`, exportFormat)
      if (exportFormat === 'csv') {
        downloadFile(generateCSV(data, cols), filename, 'text/csv')
      } else if (exportFormat === 'xlsx') {
        downloadFile(
          generateExcel(data, cols, 'Missions'),
          filename,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
      } else {
        downloadFile(generatePDF(data, cols, t('missions.title')), filename, 'application/pdf')
      }
      showToast(
        exportMode === 'detailed'
          ? t('missions.exportedLines', { count: exportRows.length })
          : t('missions.exportedRows', { count: exportRows.length }),
        'success'
      )
    } catch (err) {
      console.error('Missions export failed:', err)
      showToast(t('export.exportFailed'), 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleSortChange = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date_depart' ? 'desc' : 'asc' }))

  const columns = useMemo(
    () => [
      { key: 'om', label: t('missions.colOm'), sortable: true, render: (m) => <span className="font-medium text-primary">{m.om}</span> },
      { key: 'date_depart', label: t('missions.colDate'), sortable: true, render: (m) => formatDate(m.date_depart) },
      {
        key: 'route',
        label: t('missions.colRoute'),
        render: (m) => {
          const r = routeLabel(m)
          return (
            <div className="max-w-[260px]">
              <div className="truncate text-foreground">
                {r.from} <span className="text-muted-foreground">→</span> {r.to}
              </div>
              {r.via && <div className="truncate text-[12px] text-muted-foreground">{t('missions.via')} {r.via}</div>}
            </div>
          )
        },
      },
      {
        key: 'vehicle',
        label: t('missions.colVehicle'),
        sortable: true,
        render: (m) => {
          const chip = missionVehicleChip(m)
          return (
            <span className="inline-flex items-center gap-1">
              <Chip kind={chip.kind}>{chip.label}</Chip>
              {chip.extra > 0 && <span className="text-[12px] font-medium text-muted-foreground">+{chip.extra}</span>}
            </span>
          )
        },
      },
      {
        key: 'vehicle_type',
        label: t('missions.colVehicleType'),
        sortable: true,
        render: (m) => <span className="text-muted-foreground">{missionVehicleType(m) || '-'}</span>,
      },
      { key: 'driver', label: t('missions.colDriver'), sortable: true, render: (m) => <span className="text-foreground">{missionDriver(m)}</span> },
      {
        key: 'description',
        label: t('missions.colDescription'),
        sortable: true,
        render: (m) => {
          const desc = missionDescription(m)
          return desc ? (
            <span className="block max-w-[240px] truncate text-muted-foreground" title={desc}>
              {desc}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )
        },
      },
      {
        key: 'amount',
        label: driverQuery ? t('missions.colAmountDriver') : t('missions.colAmount'),
        sortable: true,
        render: (m) => <span className="font-semibold text-foreground">{money2(amountOf(m))}</span>,
      },
    ],
    [t, amountOf, driverQuery]
  )

  const reviewActionColumn = {
    key: 'action',
    label: '',
    render: (r) => (
      <Button
        variant="secondary"
        size="sm"
        disabled={!canTreat}
        onClick={(e) => {
          e.stopPropagation()
          setTreat({ kind: reviewTab === 'lines' ? 'expense' : 'vehicle', item: r.raw })
        }}
      >
        {t('missions.treatAction')}
      </Button>
    ),
  }

  const reviewColumns = {
    lines: [
      { key: 'om', label: t('missions.colOm'), render: (r) => <span className="font-medium text-primary">{r.om}</span> },
      { key: 'date', label: t('missions.colDate'), render: (r) => formatDate(r.date) },
      { key: 'column', label: t('missions.reviewColumn'), render: (r) => r.column || '-' },
      { key: 'category', label: t('missions.reviewCategory'), render: (r) => r.category || '-' },
      { key: 'label', label: t('missions.reviewLabel'), render: (r) => <span className="text-muted-foreground">{r.label || '-'}</span> },
      { key: 'amount', label: t('missions.colAmount'), render: (r) => money2(r.amount) },
      reviewActionColumn,
    ],
    unknown: [
      { key: 'om', label: t('missions.colOm'), render: (r) => <span className="font-medium text-primary">{r.om}</span> },
      { key: 'date', label: t('missions.colDate'), render: (r) => formatDate(r.date) },
      { key: 'type', label: t('missions.reviewType'), render: (r) => r.type || '-' },
      { key: 'label', label: t('missions.reviewLabel'), render: (r) => <span className="text-muted-foreground">{r.label || '-'}</span> },
      reviewActionColumn,
    ],
  }

  const openMission = (row) => navigate(`/missions/${row.id}`)

  let body
  if (error) {
    body = (
      <div className="rounded-md border border-border bg-card p-4">
        <ErrorState
          title={t('missions.failedToLoad')}
          description={t('ui.errorLoadDesc')}
          onRetry={() => setRetryKey((k) => k + 1)}
          retryText={t('ui.retry')}
        />
      </div>
    )
  } else if (!loading && filtered.length === 0) {
    body = (
      <EmptyState
        icon={RouteIcon}
        title={t('missions.noResults')}
        description={isSearching ? t('missions.noResultsSearch') : t('missions.noResultsRange')}
      />
    )
  } else {
    body = (
      <Table
        columns={columns}
        data={pageRows}
        loading={loading}
        skeletonRows={8}
        onRowClick={openMission}
        getRowKey={(m) => m.id}
        sortColumn={sort.key}
        sortDirection={sort.dir}
        onSortChange={handleSortChange}
        pagination={totalPages > 1}
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyMessage={t('missions.noResults')}
      />
    )
  }

  const reviewRows = reviewTab === 'lines' ? reviewQueues.lines : reviewQueues.unknown

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RouteIcon {...SF} className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('missions.title')}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{t('missions.subtitle')}</p>
          </div>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={() => navigate('/missions/new')}>
            <Plus {...SF} className="mr-1.5 h-4 w-4" />
            {t('missions.newMission')}
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card padding={false} className="p-4">
          <div className="text-[22px] font-semibold text-foreground">{kpis.missions.toLocaleString('fr-MA')}</div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('missions.kpiMissions')}
          </div>
        </Card>
        <Card padding={false} className="p-4">
          <div className="text-[22px] font-semibold text-primary">{money2(kpis.total)}</div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {driverQuery ? t('missions.kpiDriverTotal') : t('missions.kpiTotal')}
          </div>
        </Card>
        <Card padding={false} className="p-4">
          <div className={`text-[22px] font-semibold ${kpis.reviewLines > 0 ? 'text-warning' : 'text-success'}`}>
            {kpis.reviewLines.toLocaleString('fr-MA')}
          </div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('missions.kpiNeedsReview')}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <MissionFilters
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
        resultCount={filtered.length.toLocaleString('fr-MA')}
        rangeLabel={rangeLabel}
      />

      {driverQuery && (
        <p className="text-[12px] text-muted-foreground">
          {t('missions.driverScopeHint', { driver: driverQuery })}
        </p>
      )}

      {/* Export bar */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="w-56">
          <Select
            value={exportMode}
            onChange={(e) => changeExportMode(e.target.value)}
            options={[
              { value: 'summary', label: t('missions.exportModeSummary') },
              { value: 'detailed', label: t('missions.exportModeDetailed') },
            ]}
          />
        </div>
        <div className="w-40">
          <Select
            value={exportFormat === '' ? 'xlsx' : exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            options={[
              { value: 'xlsx', label: 'Excel' },
              { value: 'csv', label: 'CSV' },
              { value: 'pdf', label: 'PDF' },
            ]}
          />
        </div>
        <Button variant="secondary" onClick={() => setShowExportColumns((v) => !v)}>
          <Columns01 {...SF} className="mr-1.5 h-4 w-4" />
          {t('missions.exportColumnsBtn')}
        </Button>
        <Button variant="secondary" onClick={handleExport} loading={exporting}>
          <Download {...SF} className="mr-1.5 h-4 w-4" />
          {t('common.export')}
        </Button>
      </div>

      {showExportColumns && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-foreground">{t('missions.exportColumnsTitle')}</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {exportMode === 'detailed'
                  ? t('missions.exportColumnsHintDetailed')
                  : t('missions.exportColumnsHintSummary')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-muted-foreground">
                {t('missions.exportRowsCols', {
                  rows: exportRows.length.toLocaleString('fr-MA'),
                  cols: exportColumnsSpec.length.toLocaleString('fr-MA'),
                })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExportColumns(availableExportColumns.map((c) => c.key))}
              >
                {t('missions.exportAllColumns')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setExportColumns(
                    exportMode === 'detailed' ? MISSION_DETAIL_DEFAULT_KEYS : MISSION_SUMMARY_DEFAULT_KEYS
                  )
                }
              >
                {t('missions.exportResetColumns')}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {availableExportColumns.map((col) => {
              const isSel = exportColumns.includes(col.key)
              return (
                <button
                  key={col.key}
                  type="button"
                  aria-pressed={isSel}
                  onClick={() => toggleExportColumn(col.key)}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                    isSel ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
                  }`}
                >
                  <span className={isSel ? 'text-primary' : 'text-muted-foreground'}>
                    {isSel ? <CheckSquare {...SF} className="h-4 w-4" /> : <Square {...SF} className="h-4 w-4" />}
                  </span>
                  <span className="text-[13px] font-medium text-foreground">{t(col.labelKey)}</span>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* Table */}
      {body}

      {/* Review queues */}
      <Card>
        <div className="mb-1 flex items-center gap-2">
          <AlertTriangle {...SF} className="h-5 w-5 text-warning" />
          <h2 className="text-lg text-foreground">{t('missions.reviewTitle')}</h2>
        </div>
        <p className="mb-4 text-[12px] text-muted-foreground">{t('missions.reviewGlobalHint')}</p>

        {!canTreat && (
          <div
            className="mb-4 flex items-start gap-2 rounded-lg border p-3"
            style={{ borderColor: 'hsl(var(--warning))', background: 'hsl(var(--warning) / 0.06)' }}
          >
            <AlertTriangle {...SF} className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
            <p className="text-[13px] text-foreground">{t('missions.treatNoPermission')}</p>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setReviewTab('lines')}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
              reviewTab === 'lines' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {t('missions.reviewExpenses')} · {reviewQueues.lines.length}
          </button>
          <button
            onClick={() => setReviewTab('unknown')}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
              reviewTab === 'unknown' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {t('missions.reviewVehicles')} · {reviewQueues.unknown.length}
          </button>
        </div>

        {reviewRows.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-[14px] text-muted-foreground">
            {reviewTab === 'lines' ? t('missions.reviewExpensesEmpty') : t('missions.reviewVehiclesEmpty')}
          </div>
        ) : (
          <Table
            columns={reviewColumns[reviewTab]}
            data={reviewRows}
            getRowKey={(r) => r.key}
            onRowClick={(r) => navigate(`/missions/${r.missionId}`)}
          />
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <File01 {...SF} className="h-3.5 w-3.5" />
            {t('missions.reviewHint')}
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/missions/drivers')}>
            <Users01 {...SF} className="mr-1.5 h-4 w-4" />
            {t('missions.driverMergeOpen')}
          </Button>
          {can('import') && (
            <Button variant="secondary" size="sm" onClick={() => navigate('/missions/types')}>
              <Tag01 {...SF} className="mr-1.5 h-4 w-4" />
              {t('missions.typeWizardOpen')}
            </Button>
          )}
        </div>
      </Card>

      <ReviewTreatmentModal
        isOpen={treat != null}
        kind={treat?.kind}
        item={treat?.item}
        onClose={() => setTreat(null)}
        onSaved={() => setReviewKey((k) => k + 1)}
      />
    </div>
  )
}
