import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Truck01 as Truck,
  File01,
  CoinsStacked01 as Coins,
  CurrencyDollar as Dollar,
  FilterFunnel01 as Filter,
  BarChart03 as BarChart,
  Grid01 as Grid,
  Columns01,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Download01 as Download,
  Upload01 as Upload,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  XClose as X,
} from '@untitledui/icons'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { vehiclesApi, chargesApi } from '../../services/api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { vehicleAnnualTotal, vehicleMonthlyTotal } from '../../utils/calculations'
import { generateExportFilename, downloadFile, generateCSV, generateExcel, generatePDF } from '../../utils/parsers'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useYear } from '../../context/YearContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import MultiSelect from '../../components/ui/MultiSelect'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'

const SF = { strokeWidth: 1.75, fill: 'none' }
const PREVIEW_PAGE_SIZE = 10

// Ordered export flow — mirrors the Import wizard's step machine.
const STEP_ORDER = ['type', 'filters', 'columns', 'generate']

const EXPORT_TYPES = [
  {
    id: 'vehicles',
    icon: Truck,
    titleKey: 'export.typeVehicles',
    descKey: 'export.typeVehiclesDesc',
    defaultColumns: ['code', 'registration_plate', 'vehicle_type', 'brand', 'fuel_type', 'category_name', 'status'],
    includeCharges: false,
  },
  {
    id: 'vehicles-charges',
    icon: Coins,
    titleKey: 'export.typeVehiclesCharges',
    descKey: 'export.typeVehiclesChargesDesc',
    defaultColumns: ['code', 'registration_plate', 'vehicle_type', 'brand', 'puissance_fiscale', 'ptac', 'purchase_date', 'category_name', 'status', 'notes'],
    includeCharges: true,
  },
  {
    id: 'filtered',
    icon: Filter,
    titleKey: 'export.typeFiltered',
    descKey: 'export.typeFilteredDesc',
    defaultColumns: ['code', 'registration_plate', 'vehicle_type', 'brand', 'year', 'purchase_date', 'category_name', 'status'],
    includeCharges: false,
  },
  {
    id: 'financial',
    icon: BarChart,
    titleKey: 'export.typeFinancial',
    descKey: 'export.typeFinancialDesc',
    defaultColumns: ['code', 'registration_plate', 'vehicle_type', 'brand', 'puissance_fiscale', 'ptac', 'category_name', 'purchase_date'],
    includeCharges: true,
  },
]

// Vehicle columns available for export. Keep in sync with
// src/constants/exportColumns.js EXPORT_COLUMNS.VEHICLE + OTHER.
const VEHICLE_COLUMN_KEYS = [
  { key: 'code', labelKey: 'columns.code' },
  { key: 'registration_plate', labelKey: 'columns.registrationPlate' },
  { key: 'vehicle_type', labelKey: 'columns.vehicleType' },
  { key: 'brand', labelKey: 'columns.brand' },
  { key: 'puissance_fiscale', labelKey: 'columns.puissanceFiscale' },
  { key: 'ptac', labelKey: 'columns.ptac' },
  { key: 'fuel_type', labelKey: 'columns.fuelType' },
  { key: 'purchase_date', labelKey: 'columns.purchaseDate' },
  { key: 'category_name', labelKey: 'columns.category' },
  { key: 'status', labelKey: 'columns.status' },
  { key: 'year', labelKey: 'columns.year' },
  { key: 'notes', labelKey: 'columns.notes' },
]

const CODE_HEADER_RE = /^(code|codes|v[eé]hicule|vehicule|matricule|immatriculation)$/i

const extractCodesFromRows = (rows) => {
  const codes = []
  ;(rows || []).forEach((row, index) => {
    const cells = Array.isArray(row) ? row : Object.values(row)
    const raw = cells[0]
    if (raw === null || raw === undefined) return
    const val = String(raw).trim()
    if (!val) return
    if (index === 0 && CODE_HEADER_RE.test(val)) return
    codes.push(val.toUpperCase())
  })
  return [...new Set(codes)]
}

const parseCodesFile = (file) => {
  const isExcel = /\.(xlsx|xls)$/i.test(file.name)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    if (isExcel) {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const wb = XLSX.read(data, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
          resolve(extractCodesFromRows(rows))
        } catch (err) {
          reject(err)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = (e) => {
        const text = e.target.result
        const firstLine = text.split(/\r?\n/)[0] || ''
        const semicolons = (firstLine.match(/;/g) || []).length
        const commas = (firstLine.match(/,/g) || []).length
        const delimiter = semicolons > commas ? ';' : ','
        Papa.parse(text, {
          delimiter,
          skipEmptyLines: true,
          complete: (results) => resolve(extractCodesFromRows(results.data)),
          error: (err) => reject(err),
        })
      }
      reader.readAsText(file)
    }
  })
}

export default function Export() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { can } = useAuth()
  const { selectedYear } = useYear()
  const canViewCharges = can('charges')

  const availableExportTypes = useMemo(
    () => (canViewCharges ? EXPORT_TYPES : EXPORT_TYPES.filter((et) => !et.includeCharges)),
    [canViewCharges]
  )

  const [step, setStep] = useState('type')

  const [vehicles, setVehicles] = useState([])
  const [charges, setCharges] = useState([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const [exportType, setExportType] = useState(canViewCharges ? 'vehicles-charges' : 'vehicles')
  const [includeCharges, setIncludeCharges] = useState(canViewCharges)
  const [selectedColumns, setSelectedColumns] = useState(
    (canViewCharges ? EXPORT_TYPES[1] : EXPORT_TYPES[0]).defaultColumns
  )
  const [exportFormat, setExportFormat] = useState('xlsx')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterCategories, setFilterCategories] = useState([])
  const [filterStatus, setFilterStatus] = useState('')

  const [codesText, setCodesText] = useState('')
  const [fileCodes, setFileCodes] = useState([])
  const [codesFileName, setCodesFileName] = useState('')
  const [codesError, setCodesError] = useState('')
  const codesFileInputRef = useRef(null)

  const [selected, setSelected] = useState(new Set())
  const [showList, setShowList] = useState(false)
  const [previewPage, setPreviewPage] = useState(1)

  const [generating, setGenerating] = useState(false)

  const effectiveCodes = useMemo(() => {
    const textCodes = codesText
      .split(/[\s,;]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean)
    return [...new Set([...textCodes, ...fileCodes])]
  }, [codesText, fileCodes])

  useEffect(() => {
    if (!canViewCharges) {
      setIncludeCharges(false)
      setExportType((prev) => {
        const current = EXPORT_TYPES.find((et) => et.id === prev)
        return current?.includeCharges ? 'vehicles' : prev
      })
    }
  }, [canViewCharges])

  useEffect(() => {
    let active = true
    const loadData = async () => {
      setInitialLoading(true)
      setLoadError(false)
      try {
        const [vehicleData, chargesData] = await Promise.all([
          vehiclesApi.list(),
          canViewCharges ? chargesApi.list({ year: selectedYear }) : Promise.resolve([]),
        ])
        if (!active) return
        setVehicles(vehicleData || [])
        setCharges(chargesData || [])
      } catch (error) {
        if (active) setLoadError(true)
      } finally {
        if (active) setInitialLoading(false)
      }
    }
    loadData()
    return () => {
      active = false
    }
  }, [retryKey, selectedYear, canViewCharges])

  const vehicleColumns = useMemo(
    () => VEHICLE_COLUMN_KEYS.map((c) => ({ key: c.key, label: t(c.labelKey) })),
    [t]
  )

  // Centralized cost calculation: every value flows through
  // vehicleAnnualTotal / vehicleMonthlyTotal (src/utils/calculations.ts).
  const costData = useMemo(() => {
    const pivot = new Map()
    const annual = new Map()
    const monthly = new Map()
    const typeNames = new Set()
    const typeCounts = new Map()
    const byVehicle = new Map()

    vehicles.forEach((v) => {
      byVehicle.set(v.id, [])
      pivot.set(v.id, {})
      annual.set(v.id, 0)
      monthly.set(v.id, 0)
    })

    charges.forEach((ch) => {
      const ctype = ch.charge_type || {}
      const label = ctype.display_name || ctype.name || ''
      if (!ch.vehicle_id || !label) return
      const arr = byVehicle.get(ch.vehicle_id) || []
      arr.push(ch)
      byVehicle.set(ch.vehicle_id, arr)

      const p = pivot.get(ch.vehicle_id) || {}
      p[label] = (p[label] || 0) + (Number(ch.amount) || 0)
      pivot.set(ch.vehicle_id, p)

      typeNames.add(label)
      typeCounts.set(label, (typeCounts.get(label) || 0) + 1)
    })

    vehicles.forEach((v) => {
      const arr = byVehicle.get(v.id) || []
      annual.set(v.id, vehicleAnnualTotal(arr))
      monthly.set(v.id, vehicleMonthlyTotal(v, arr))
    })

    return {
      pivot,
      annual,
      monthly,
      typeNames: [...typeNames].sort(),
      typeCounts,
    }
  }, [vehicles, charges])

  const categories = useMemo(() => {
    const set = new Set()
    vehicles.forEach((v) => {
      if (v.category?.name) set.add(v.category.name)
    })
    return [...set].sort()
  }, [vehicles])

  const years = useMemo(() => {
    const set = new Set()
    vehicles.forEach((v) => {
      if (v.purchase_date) {
        const y = new Date(v.purchase_date).getFullYear()
        if (!Number.isNaN(y)) set.add(y)
      }
    })
    return [...set].sort((a, b) => b - a).map(String)
  }, [vehicles])

  const filteredVehicles = useMemo(() => {
    let result = [...vehicles]

    if (filterYear) {
      result = result.filter((v) => (v.purchase_date ? new Date(v.purchase_date).getFullYear().toString() === filterYear : false))
    }
    if (filterCategories.length > 0) {
      result = result.filter((v) => filterCategories.includes(v.category?.name))
    }
    if (filterStatus) {
      result = result.filter((v) => v.status === filterStatus)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toUpperCase().trim()
      result = result.filter(
        (v) =>
          v.code?.toUpperCase().includes(q) ||
          v.registration_plate?.toUpperCase().includes(q) ||
          v.ww_plate?.toUpperCase().includes(q) ||
          v.brand?.toUpperCase().includes(q) ||
          v.model?.toUpperCase().includes(q)
      )
    }
    if (effectiveCodes.length > 0) {
      const codeSet = new Set(effectiveCodes)
      result = result.filter((v) => codeSet.has(String(v.code || '').toUpperCase()))
    }

    return result
  }, [vehicles, filterYear, filterCategories, filterStatus, searchQuery, effectiveCodes])

  const codeMatchedCount = useMemo(() => {
    if (effectiveCodes.length === 0) return 0
    const codeSet = new Set(effectiveCodes)
    return vehicles.filter((v) => codeSet.has(String(v.code || '').toUpperCase())).length
  }, [vehicles, effectiveCodes])

  // Selecting a vehicle list technology: default select-all of the current
  // filtered result; manual toggles persist until the filtered set changes.
  useEffect(() => {
    setSelected(new Set(filteredVehicles.map((v) => v.id)))
  }, [filteredVehicles])

  useEffect(() => {
    setPreviewPage(1)
  }, [filteredVehicles, selected, selectedColumns, includeCharges, costData.typeNames])

  const selectedVehicles = useMemo(() => filteredVehicles.filter((v) => selected.has(v.id)), [filteredVehicles, selected])

  const handleSwitchType = (id) => {
    if (id === exportType) return
    const type = availableExportTypes.find((et) => et.id === id)
    if (!type) return
    setExportType(id)
    setSelectedColumns(type.defaultColumns)
    setIncludeCharges(canViewCharges && type.includeCharges)
    setStep('type')
  }

  const handleCodesFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const codes = await parseCodesFile(file)
      if (codes.length === 0) {
        setCodesError(t('export.codesFileEmpty'))
        return
      }
      setFileCodes((prev) => [...new Set([...prev, ...codes])])
      setCodesFileName(file.name)
      setCodesError('')
      showToast(t('export.codesFileLoaded', { count: codes.length }), 'success')
    } catch (err) {
      setCodesError(t('export.codesFileError'))
    }
  }

  const clearCodes = () => {
    setCodesText('')
    setFileCodes([])
    setCodesFileName('')
    setCodesError('')
  }

  const toggleVehicle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === filteredVehicles.length ? new Set() : new Set(filteredVehicles.map((v) => v.id))
    )
  }

  const toggleColumn = (key) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const exportColumnsSpec = useMemo(() => {
    const vehicleCols = vehicleColumns.filter((c) => selectedColumns.includes(c.key))
    const showCharges = canViewCharges && includeCharges
    const chargeCols = showCharges
      ? costData.typeNames.map((name) => ({ key: `charge_${name}`, label: name }))
      : []
    const totalCols =
      showCharges && chargeCols.length > 0
        ? [
            { key: '_total', label: t('columns.total') },
            { key: '_monthly', label: t('export.monthly') },
          ]
        : []
    return [...vehicleCols, ...chargeCols, ...totalCols]
  }, [vehicleColumns, selectedColumns, canViewCharges, includeCharges, costData.typeNames, t])

  const buildRow = (vehicle) => {
    const row = {}
    const pivot = costData.pivot.get(vehicle.id) || {}
    exportColumnsSpec.forEach((col) => {
      if (col.key === 'category_name') row[col.key] = vehicle.category?.name || ''
      else if (col.key === 'year') row[col.key] = vehicle.purchase_date ? new Date(vehicle.purchase_date).getFullYear() : ''
      else if (col.key === 'notes') row[col.key] = vehicle.notes || ''
      else if (col.key.startsWith('charge_')) row[col.key] = pivot[col.label] || 0
      else if (col.key === '_total') row[col.key] = costData.annual.get(vehicle.id) || 0
      else if (col.key === '_monthly') row[col.key] = costData.monthly.get(vehicle.id) || 0
      else row[col.key] = vehicle[col.key] ?? ''
    })
    return row
  }

  const exportRows = useMemo(() => selectedVehicles.map((v) => ({ id: v.id, values: buildRow(v) })), [selectedVehicles, exportColumnsSpec, costData]) // eslint-disable-line react-hooks/exhaustive-deps

  const previewColumns = useMemo(
    () =>
      exportColumnsSpec.map((col) => {
        let render
        if (col.key.startsWith('charge_') || col.key === '_total' || col.key === '_monthly') {
          render = (r) => (
            <span className={col.key === '_total' || col.key === '_monthly' ? 'font-semibold text-primary' : 'text-foreground'}>
              {formatCurrency(Number(r.values[col.key]) || 0)}
            </span>
          )
        } else if (col.key === 'purchase_date') {
          render = (r) => formatDate(r.values[col.key])
        } else {
          render = (r) => {
            const v = r.values[col.key]
            return <span className="text-foreground">{v === '' || v === null || v === undefined ? '-' : String(v)}</span>
          }
        }
        return { key: col.key, label: col.label, render }
      }),
    [exportColumnsSpec]
  )

  const pageTotal = useMemo(() => Math.max(1, Math.ceil(exportRows.length / PREVIEW_PAGE_SIZE)), [exportRows.length])
  const previewRows = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE
    return exportRows.slice(start, start + PREVIEW_PAGE_SIZE)
  }, [exportRows, previewPage])

  const handleGenerate = async () => {
    if (exportRows.length === 0 || exportColumnsSpec.length === 0) {
      showToast(t('export.noVehiclesSelected'), 'warning')
      return
    }
    try {
      setGenerating(true)
      const columns = exportColumnsSpec
      const data = exportRows.map((r) => r.values)
      const ext = exportFormat === 'xlsx' ? 'xlsx' : exportFormat
      const filename = generateExportFilename(`SMG-Fleet-${exportType}`, ext)

      if (exportFormat === 'csv') {
        downloadFile(generateCSV(data, columns), filename, 'text/csv')
      } else if (exportFormat === 'xlsx') {
        downloadFile(generateExcel(data, columns), filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      } else {
        downloadFile(generatePDF(data, columns, t('export.title')), filename, 'application/pdf')
      }

      showToast(`${exportRows.length} ${t('export.vehiclesExported')}`, 'success')
    } catch (error) {
      showToast(t('export.exportFailed'), 'error')
    } finally {
      setGenerating(false)
    }
  }

  const stepIndex = STEP_ORDER.indexOf(step)
  const stepperSteps = [
    { key: 'type', label: t('export.steps.type'), icon: Grid },
    { key: 'filters', label: t('export.steps.filters'), icon: Filter },
    { key: 'columns', label: t('export.steps.columns'), icon: Columns01 },
    { key: 'generate', label: t('export.steps.generate'), icon: Download },
  ]

  const canContinueFilters = selectedVehicles.length > 0
  const canContinueColumns = exportColumnsSpec.length > 0

  const renderType = () => (
    <Card>
      <div className="mb-1">
        <h2 className="text-lg text-foreground">{t('export.typeTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('export.typeSubtitle')}</p>
      </div>

      <div className={`mt-5 grid grid-cols-1 auto-rows-fr gap-3 sm:grid-cols-2 ${availableExportTypes.length > 2 ? 'lg:grid-cols-4' : ''}`}>
        {availableExportTypes.map((type) => {
          const Icon = type.icon
          const isActive = exportType === type.id
          return (
            <button
              key={type.id}
              onClick={() => handleSwitchType(type.id)}
              className={`flex flex-col rounded-lg border p-4 text-left transition-all ${
                isActive ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <div
                className={`mb-3 flex h-10 w-10 items-center justify-center rounded-md ${
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon {...SF} className="h-5 w-5" />
              </div>
              <div className="text-[15px] font-semibold text-foreground">{t(type.titleKey)}</div>
              <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{t(type.descKey)}</div>
              {type.includeCharges && (
                <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[12px] font-semibold text-primary">
                  <Dollar {...SF} className="h-3.5 w-3.5" />
                  {t('export.chargesIncluded')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">
          {vehicles.length.toLocaleString('fr-MA')} {t('export.fleetCount')}
        </span>
        <Button onClick={() => setStep('filters')}>
          {t('export.continue')}
          <ArrowRight {...SF} className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </Card>
  )

  const renderFilters = () => (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg text-foreground">{t('export.filtersTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('export.filtersSubtitle')}</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1.5 text-[13px] font-semibold text-muted-foreground">
          {filteredVehicles.length} {t('export.vehicles')} · {selectedVehicles.length} {t('export.selected')}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder={t('export.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select
          options={years.map((y) => ({ value: y, label: y }))}
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          placeholder={t('export.year')}
          showAll
        />
        <MultiSelect
          options={categories.map((c) => ({ value: c, label: c }))}
          value={filterCategories}
          onChange={setFilterCategories}
          placeholder={t('export.category')}
          showAll
          allLabel={t('export.allCategories')}
        />
        <Select
          options={[
            { value: 'active', label: t('export.active') },
            { value: 'sold', label: t('export.sold') },
          ]}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          placeholder={t('export.status')}
          showAll
        />
      </div>

      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-foreground">{t('export.codesFilterTitle')}</span>
          {effectiveCodes.length > 0 && (
            <span className="text-[13px] font-medium text-muted-foreground">
              {t('export.codesMatched', { matched: codeMatchedCount, total: effectiveCodes.length })}
            </span>
          )}
        </div>
        <textarea
          rows={3}
          value={codesText}
          onChange={(e) => setCodesText(e.target.value)}
          placeholder={t('export.codesPlaceholder')}
          className="w-full resize-y rounded-lg border border-border bg-background px-3.5 py-2.5 text-[15px] text-foreground shadow-sm transition-all focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => codesFileInputRef.current?.click()}>
            <Upload {...SF} className="h-4 w-4 mr-1.5" />
            {t('export.uploadCodes')}
          </Button>
          <input
            ref={codesFileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleCodesFile}
          />
          {codesFileName && (
            <span className="flex max-w-[220px] items-center gap-1 rounded-full bg-background px-2.5 py-1 text-[13px] font-medium text-muted-foreground">
              <File01 {...SF} className="h-3.5 w-3.5" />
              <span className="truncate">{codesFileName}</span>
              <button
                onClick={() => {
                  setFileCodes([])
                  setCodesFileName('')
                }}
                className="hover:text-destructive"
                aria-label={t('export.clearCodes')}
              >
                <X {...SF} className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          {(codesText.trim() || fileCodes.length > 0) && (
            <Button variant="ghost" size="sm" onClick={clearCodes}>
              <X {...SF} className="h-4 w-4 mr-1.5" />
              {t('export.clearCodes')}
            </Button>
          )}
          {codesError && <span className="text-[13px] font-medium text-destructive">{codesError}</span>}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={toggleAll}>
          {selected.size === filteredVehicles.length && filteredVehicles.length > 0 ? t('export.deselectAll') : t('export.selectAll')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowList((v) => !v)}
        >
          {showList ? <ChevronUp {...SF} className="h-4 w-4 mr-1.5" /> : <ChevronDown {...SF} className="h-4 w-4 mr-1.5" />}
          {showList ? t('export.hideList') : t('export.showList')}
        </Button>
      </div>

      {showList && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-border">
          {filteredVehicles.map((vehicle) => {
            const isSelected = selected.has(vehicle.id)
            return (
              <button
                key={vehicle.id}
                onClick={() => toggleVehicle(vehicle.id)}
                className="flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-muted"
                style={{ borderBottom: '1px solid hsl(var(--border))' }}
              >
                <span className={isSelected ? 'text-primary' : 'text-muted-foreground'}>
                  {isSelected ? <CheckSquare {...SF} className="h-4 w-4" /> : <Square {...SF} className="h-4 w-4" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="text-[14px] font-semibold text-foreground">{vehicle.code}</span>
                  <span className="ml-2 text-[13px] text-muted-foreground">{vehicle.registration_plate}</span>
                </span>
                <span className="text-[13px] text-muted-foreground">{vehicle.brand}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <Button variant="secondary" onClick={() => setStep('type')}>
          <ArrowLeft {...SF} className="h-4 w-4 mr-1.5" />
          {t('export.back')}
        </Button>
        <Button onClick={() => setStep('columns')} disabled={!canContinueFilters}>
          {t('export.continue')}
          <ArrowRight {...SF} className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </Card>
  )

  const renderColumns = () => (
    <Card>
      <div className="mb-1">
        <h2 className="text-lg text-foreground">{t('export.columnsTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('export.columnsSubtitle')}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {vehicleColumns.map((col) => {
          const isSel = selectedColumns.includes(col.key)
          return (
            <button
              key={col.key}
              onClick={() => toggleColumn(col.key)}
              className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                isSel ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <span className={isSel ? 'text-primary' : 'text-muted-foreground'}>
                {isSel ? <CheckSquare {...SF} className="h-4 w-4" /> : <Square {...SF} className="h-4 w-4" />}
              </span>
              <span className="text-[13px] font-medium text-foreground">{col.label}</span>
            </button>
          )
        })}
      </div>

      {canViewCharges && (
        <>
          <div className="mt-5 flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <span className="text-[14px] font-semibold text-foreground">{t('export.includeCharges')}</span>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {includeCharges
                  ? t('export.chargesOnNote', { count: costData.typeNames.length })
                  : t('export.chargesOffNote')}
              </p>
            </div>
            <button
              onClick={() => setIncludeCharges((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${includeCharges ? 'bg-primary' : 'bg-muted'}`}
              aria-pressed={includeCharges}
              aria-label={t('export.includeCharges')}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${includeCharges ? 'left-6' : 'left-1'}`}
              />
            </button>
          </div>

          {includeCharges && costData.typeNames.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[13px] font-medium text-muted-foreground">{t('export.chargeColumns')}</p>
              <div className="flex flex-wrap gap-1.5">
                {costData.typeNames.map((name) => (
                  <span key={name} className="rounded-full bg-primary/10 px-2.5 py-1 text-[12px] font-semibold text-primary">
                    {name} · {costData.typeCounts.get(name) || 0}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">{t('columns.total')}</span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">{t('export.monthly')}</span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-5">
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">{t('export.formatTitle')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { key: 'xlsx', label: 'Excel', desc: '.xlsx' },
            { key: 'csv', label: 'CSV', desc: '.csv' },
            { key: 'pdf', label: 'PDF', desc: '.pdf' },
          ].map((fmt) => {
            const isSel = exportFormat === fmt.key
            return (
              <button
                key={fmt.key}
                onClick={() => setExportFormat(fmt.key)}
                className={`rounded-lg border px-4 py-3 text-center transition-colors ${
                  isSel ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
                }`}
              >
                <div className="text-[15px] font-semibold text-foreground">{fmt.label}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{fmt.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <Button variant="secondary" onClick={() => setStep('filters')}>
          <ArrowLeft {...SF} className="h-4 w-4 mr-1.5" />
          {t('export.back')}
        </Button>
        <Button onClick={() => setStep('generate')} disabled={!canContinueColumns}>
          {t('export.continue')}
          <ArrowRight {...SF} className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </Card>
  )

  const renderGenerate = () => {
    const typeLabel = t(EXPORT_TYPES.find((et) => et.id === exportType)?.titleKey || 'export.title')
    const acronym = (exportFormat === 'xlsx' ? 'Excel' : exportFormat.toUpperCase())
    const summaryChips = [
      { key: 'type', label: t('export.summaryType'), value: typeLabel },
      { key: 'rows', label: t('export.summaryRows'), value: exportRows.length.toLocaleString('fr-MA') },
      { key: 'cols', label: t('export.summaryColumns'), value: exportColumnsSpec.length.toLocaleString('fr-MA') },
      { key: 'fmt', label: t('export.summaryFormat'), value: acronym },
      { key: 'veh', label: t('export.summaryFleet'), value: vehicles.length.toLocaleString('fr-MA') },
    ]

    return (
      <Card>
        <div className="mb-1">
          <h2 className="text-lg text-foreground">{t('export.previewTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('export.previewSubtitle')}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {summaryChips.map((chip) => (
            <div key={chip.key} className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[20px] font-semibold text-foreground">{chip.value}</div>
              <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{chip.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-border">
          <Table
            columns={previewColumns}
            data={previewRows}
            getRowKey={(r) => r.id}
            pagination
            currentPage={previewPage}
            totalPages={pageTotal}
            onPageChange={setPreviewPage}
            emptyMessage={t('ui.noData')}
          />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Button variant="secondary" onClick={() => setStep('columns')}>
            <ArrowLeft {...SF} className="h-4 w-4 mr-1.5" />
            {t('export.back')}
          </Button>
          <Button onClick={handleGenerate} loading={generating} disabled={exportRows.length === 0}>
            <Download {...SF} className="h-4 w-4 mr-1.5" />
            {generating ? t('export.generating') : t('export.generateBtn', { count: exportRows.length })}
          </Button>
        </div>
      </Card>
    )
  }

  const page = (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('export.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('export.subtitle')}</p>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto">
        {stepperSteps.map((s, i) => {
          const Icon = s.icon
          const isActive = i === stepIndex
          const isDone = i < stepIndex
          const isClickable = i < stepIndex
          return (
            <div key={s.key} className="flex flex-1 items-center gap-1">
              <button
                onClick={() => isClickable && setStep(s.key)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition-all ${
                  isClickable ? 'cursor-pointer hover:bg-muted' : 'cursor-default'
                }`}
                style={{
                  color: isActive ? 'hsl(var(--primary))' : isDone ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={{
                    background: isActive ? 'hsl(var(--primary))' : isDone ? 'hsl(var(--success) / 0.15)' : 'hsl(var(--muted))',
                    color: isActive ? 'white' : isDone ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {isDone ? <CheckCircle {...SF} className="h-3.5 w-3.5" /> : <Icon {...SF} className="h-3.5 w-3.5" />}
                </span>
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
              {i < stepperSteps.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          )
        })}
      </div>

      {step === 'type' && renderType()}
      {step === 'filters' && renderFilters()}
      {step === 'columns' && renderColumns()}
      {step === 'generate' && renderGenerate()}
    </div>
  )

  if (initialLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-16">
        <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <Card>
          <div className="space-y-3">
            <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
          </div>
        </Card>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-16">
        <h1 className="text-2xl font-bold text-foreground">{t('export.title')}</h1>
        <Card>
          <ErrorState
            title={t('export.failedToLoad')}
            description={t('ui.errorLoadDesc')}
            onRetry={() => setRetryKey((k) => k + 1)}
            retryText={t('ui.retry')}
          />
        </Card>
      </div>
    )
  }

  if (vehicles.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-16">
        <h1 className="text-2xl font-bold text-foreground">{t('export.title')}</h1>
        <Card>
          <EmptyState icon={Truck} title={t('export.noVehicles')} description={t('export.noVehiclesDesc')} />
        </Card>
      </div>
    )
  }

  return page
}