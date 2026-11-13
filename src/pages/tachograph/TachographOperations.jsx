import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Edit01 as Edit,
  Trash01 as Trash,
  Eye,
  Tool01,
  Coins01,
  CreditCard01,
  AlertTriangle,
  Building01,
  Copy01 as Duplicate,
  Download01 as Download,
  FileCheck01,
} from '@untitledui/icons'
import { tachographApi, vehiclesApi } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { generateExcel, downloadFile, generateExportFilename } from '../../utils/parsers'
import { todayISO, operationTypeLabel, daysUntil } from '../../utils/tachograph'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Card from '../../components/ui/Card'
import KpiCard from '../../components/ui/KpiCard'
import Table from '../../components/ui/Table'
import Modal, { ConfirmModal } from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import { PageSpinner } from '../../components/ui/Spinner'
import TachographTabs from './TachographTabs'

const SF = { strokeWidth: 1.75, fill: 'none' }

// Line prices are HT and VAT is 20%. The rate is stored on each operation so a
// future change never rewrites past amounts.
const VAT_RATE = 20

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100

const totalsOf = (ht, rate = VAT_RATE) => {
  const amountHT = Number(ht) || 0
  const vat = round2((amountHT * (Number(rate) || 0)) / 100)
  return { ht: amountHT, vat, ttc: round2(amountHT + vat) }
}

// Operations saved before multi-line support have no lines: their header price
// and article stand in for the single line.
const rowLines = (row) =>
  row.items?.length
    ? row.items
    : row.operation_type_id || row.price_paid != null
      ? [{ operation_type_id: row.operation_type_id, price: row.price_paid, operation_type: row.operation_type, vehicle: row.vehicle }]
      : []

const rowHT = (row) => rowLines(row).reduce((sum, line) => sum + (Number(line.price) || 0), 0)

const hasPurchaseOrder = (row) => Boolean(String(row.purchase_order || '').trim())

// Days elapsed since the operation; a future date counts as zero.
const ageInDays = (row) => Math.max(0, -(daysUntil(row.performed_on) ?? 0))

// "2026-11" -> "Novembre 2026".
const monthLabel = (value, language) => {
  const [y, m] = String(value || '').split('-').map(Number)
  if (!y || !m) return value
  const label = new Date(y, m - 1, 1).toLocaleDateString(language, {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// An operation can cover several vehicles: one line per vehicle. Lines saved
// before per-line vehicles fall back to the operation's own vehicle.
const rowVehicles = (row) => {
  const seen = new Map()
  for (const line of rowLines(row)) {
    const vehicle = line.vehicle || row.vehicle
    if (vehicle?.id != null && !seen.has(vehicle.id)) seen.set(vehicle.id, vehicle)
  }
  if (!seen.size && row.vehicle) seen.set(row.vehicle.id, row.vehicle)
  return [...seen.values()]
}

const emptyItem = (vehicleId = '', vehiclePlate = '') => ({
  operation_type_id: '',
  type_query: '',
  vehicle_id: vehicleId ? String(vehicleId) : '',
  vehicle_query: vehiclePlate,
  quantity: '1',
  unit_price: '',
})

const itemTotal = (item) =>
  round2((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))

// 1 -> "1", 1.5 -> "1.50".
const formatQty = (value) => {
  const qty = Number(value ?? 1)
  if (!Number.isFinite(qty)) return '—'
  return qty % 1 === 0 ? String(qty) : qty.toFixed(2)
}

const emptyForm = (vehicleId = '', vehiclePlate = '') => ({
  supplier_id: '',
  performed_on: todayISO(),
  items: [emptyItem(vehicleId, vehiclePlate)],
  chantier: '',
  reference: '',
  purchase_order: '',
  notes: '',
  // Set when the form was opened from a demand (bon de demande).
  demand_id: '',
})

export default function TachographOperations() {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const { can } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const canCreate = can('addTachograph')
  const canEdit = can('editTachograph')
  const canDelete = can('deleteTachograph')

  const [rows, setRows] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [types, setTypes] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const [search, setSearch] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [operationTypeId, setOperationTypeId] = useState('')
  const [chantier, setChantier] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [bc, setBc] = useState('')
  const [viewing, setViewing] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  // The demand the form was opened from, shown as a banner in the modal.
  const [linkedDemand, setLinkedDemand] = useState(null)
  const demandLinkRef = useRef('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [operations, supplierRows, typeRows, vehicleRows] = await Promise.all([
        tachographApi.listOperations(),
        tachographApi.listSuppliers(),
        tachographApi.listOperationTypes(),
        vehiclesApi.listKeys(),
      ])
      setRows(operations || [])
      setSuppliers(supplierRows || [])
      setTypes(typeRows || [])
      setVehicles(vehicleRows || [])
    } catch (e) {
      console.error('Error loading tachograph operations:', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, retryKey])

  const openCreate = useCallback((vehicleId = '') => {
    const vehicle = vehicles.find((v) => String(v.id) === String(vehicleId))
    setEditing(null)
    setLinkedDemand(null)
    demandLinkRef.current = ''
    setForm(emptyForm(vehicleId, vehicle?.registration_plate || ''))
    setModalOpen(true)
  }, [vehicles])

  // Deep link from the due page: /tachograph?new=1&vehicle=<id>
  // and from a demand: /tachograph?new=1&demand=<id>. A demand prefills the
  // vehicle, worksite and request, so the operation it becomes is never typed
  // twice. The article itself is always chosen on the operation.
  useEffect(() => {
    if (loading) return
    if (searchParams.get('new') !== '1') return

    const demandId = searchParams.get('demand')
    const vehicleId = searchParams.get('vehicle') || ''

    const next = new URLSearchParams(searchParams)
    next.delete('new')
    next.delete('vehicle')
    next.delete('demand')
    setSearchParams(next, { replace: true })

    if (!demandId) {
      openCreate(vehicleId)
      return
    }
    // Guard against a second fetch for the same demand (params are cleared
    // above, so this only matters if the link is followed twice).
    if (demandLinkRef.current === String(demandId)) return
    demandLinkRef.current = String(demandId)

    // The link is consumed above (the params are cleared), so no cancellation
    // flag: an effect re-run on the cleared params returns before this point and
    // the in-flight fetch must still be allowed to open the form.
    tachographApi
      .getDemand(demandId)
      .then((demand) => {
        if (!demand) return
        const lines = [...(demand.items || [])].sort((a, b) => (a.id || 0) - (b.id || 0))
        const items = lines.length
          ? lines.map((line) => ({
              // The precise article is chosen here, not on the demand.
              operation_type_id: '',
              type_query: '',
              vehicle_id: line.vehicle_id ? String(line.vehicle_id) : '',
              vehicle_query: line.vehicle?.registration_plate || '',
              quantity: '1',
              unit_price: '',
            }))
          : [emptyItem()]
        setEditing(null)
        setLinkedDemand(demand)
        setForm({
          supplier_id: '',
          performed_on: todayISO(),
          items,
          chantier: demand.chantier || '',
          reference: '',
          purchase_order: '',
          notes: demand.notes || '',
          demand_id: String(demand.id),
        })
        setModalOpen(true)
      })
      .catch((e) => {
        console.error('Error loading the demand for the operation form:', e)
        showToast(t('tachograph.demandLoadFailed'), 'error')
      })
  }, [loading, searchParams, setSearchParams, openCreate, showToast, t])

  // Deep link from the notification bell: /tachograph?bc=missing
  useEffect(() => {
    const param = searchParams.get('bc')
    if (param !== 'missing' && param !== 'present') return
    setBc(param)
    const next = new URLSearchParams(searchParams)
    next.delete('bc')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
    setLinkedDemand(null)
    demandLinkRef.current = ''
    setForm(emptyForm())
  }

  const openEdit = (row) => {
    const existing = row.items?.length
      ? [...row.items].sort((a, b) => (a.id || 0) - (b.id || 0))
      : [{ operation_type_id: row.operation_type_id, price: row.price_paid, vehicle: row.vehicle }]
    const items = existing.map((item) => ({
      operation_type_id: item.operation_type_id ? String(item.operation_type_id) : '',
      type_query: operationTypeLabel(item.operation_type, i18n.language),
      vehicle_id: item.vehicle_id ? String(item.vehicle_id) : row.vehicle_id ? String(row.vehicle_id) : '',
      vehicle_query: item.vehicle?.registration_plate || row.vehicle?.registration_plate || '',
      quantity: item.quantity == null ? '1' : String(Number(item.quantity)),
      unit_price:
        item.unit_price != null
          ? String(Number(item.unit_price))
          : item.price == null
            ? ''
            : String(Number(item.price)),
    }))
    setEditing(row)
    setLinkedDemand(row.demand || null)
    setForm({
      supplier_id: String(row.supplier_id),
      performed_on: row.performed_on || todayISO(),
      items: items.length ? items : [emptyItem()],
      chantier: row.chantier || '',
      reference: row.reference || '',
      purchase_order: row.purchase_order || '',
      notes: row.notes || '',
      demand_id: row.demand_id ? String(row.demand_id) : '',
    })
    setModalOpen(true)
  }

  // The plate (or the vehicle code) typed in the field resolves to a vehicle id.
  const matchVehicle = useCallback((value) => {
    const term = String(value || '').trim().toLowerCase()
    if (!term) return null
    return (
      vehicles.find((v) => String(v.registration_plate || '').trim().toLowerCase() === term) ||
      vehicles.find((v) => String(v.code || '').trim().toLowerCase() === term) ||
      null
    )
  }, [vehicles])

  const patchItemVehicle = (index, value) => {
    const match = matchVehicle(value)
    updateItem(index, { vehicle_query: value, vehicle_id: match ? String(match.id) : '' })
  }

  // The article is typed, not picked from a select: the label resolves back to
  // the operation type id, in the active language (or its code / FR / EN name).
  const matchOperationType = useCallback(
    (value) => {
      const term = String(value || '').trim().toLowerCase()
      if (!term) return null
      return (
        types.find((ty) => operationTypeLabel(ty, i18n.language).toLowerCase() === term) ||
        types.find((ty) => String(ty.name_fr || '').toLowerCase() === term) ||
        types.find((ty) => String(ty.name_en || '').toLowerCase() === term) ||
        types.find((ty) => String(ty.code || '').toLowerCase() === term) ||
        null
      )
    },
    [types, i18n.language]
  )

  const patchItemType = (index, value) => {
    const match = matchOperationType(value)
    updateItem(index, { type_query: value, operation_type_id: match ? String(match.id) : '' })
  }

  const updateItem = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }
  const addItem = () =>
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, emptyItem()],
    }))
  const removeItem = (index) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== index) : prev.items,
    }))

  // Same article on another vehicle: copy the line and let the plate be typed.
  const duplicateItem = (index) =>
    setForm((prev) => {
      const copy = { ...prev.items[index], vehicle_id: '', vehicle_query: '' }
      const items = [...prev.items]
      items.splice(index + 1, 0, copy)
      return { ...prev, items }
    })

  const itemsHT = form.items.reduce((sum, item) => sum + itemTotal(item), 0)
  const formTotals = totalsOf(itemsHT, VAT_RATE)

  // A demand only carries a kind (repair / periodic inspection); the article is
  // chosen on the operation itself.
  const demandKindLabel = (kind) =>
    t(kind === 'visite_periodique' ? 'tachograph.demandKindPeriodic' : 'tachograph.demandKindRepair')

  const handleSave = async () => {
    const items = form.items
      .filter((item) => item.operation_type_id)
      .map((item) => ({
        operation_type_id: Number(item.operation_type_id),
        vehicle_id: item.vehicle_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))

    if (form.items.some((item) => item.type_query && !item.operation_type_id)) {
      showToast(t('tachograph.articleNotFound'), 'error')
      return
    }
    if (!form.supplier_id || !form.performed_on || items.length === 0) {
      showToast(t('tachograph.requiredFields'), 'error')
      return
    }
    if (items.some((item) => !item.vehicle_id)) {
      showToast(t('tachograph.lineVehicleRequired'), 'error')
      return
    }
    if (items.some((item) => item.quantity === '' || isNaN(Number(item.quantity)) || Number(item.quantity) <= 0)) {
      showToast(t('tachograph.invalidQuantity'), 'error')
      return
    }
    if (items.some((item) => item.unit_price === '' || isNaN(Number(item.unit_price)) || Number(item.unit_price) < 0)) {
      showToast(t('tachograph.invalidPrice'), 'error')
      return
    }

    const payload = {
      vehicle_id: items[0].vehicle_id,
      supplier_id: form.supplier_id,
      performed_on: form.performed_on,
      chantier: form.chantier,
      vat_rate: VAT_RATE,
      reference: form.reference,
      purchase_order: form.purchase_order,
      notes: form.notes,
      // Only sent when the form came from a demand: a plain edit must not
      // detach an operation from its request.
      ...(form.demand_id ? { demand_id: Number(form.demand_id) } : {}),
      items: items.map((item) => ({
        operation_type_id: item.operation_type_id,
        vehicle_id: Number(item.vehicle_id),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
    }

    try {
      setSaving(true)
      if (editing) {
        await tachographApi.updateOperation(editing.id, payload)
      } else {
        await tachographApi.createOperation(payload)
      }
      showToast(t('tachograph.operationSaved'), 'success')
      // Reset directly: closeModal() refuses while `saving` is still true.
      setModalOpen(false)
      setEditing(null)
      setLinkedDemand(null)
      demandLinkRef.current = ''
      setForm(emptyForm())
      load()
    } catch (e) {
      console.error('Error saving tachograph operation:', e)
      showToast(t('tachograph.operationSaveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      setDeletingBusy(true)
      await tachographApi.deleteOperation(deleting.id)
      showToast(t('tachograph.operationDeleted'), 'success')
      setDeleting(null)
      load()
    } catch (e) {
      console.error('Error deleting tachograph operation:', e)
      showToast(t('tachograph.operationDeleteFailed'), 'error')
    } finally {
      setDeletingBusy(false)
    }
  }

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: String(s.id), label: s.name })),
    [suppliers]
  )
  const typeOptions = useMemo(
    () => types.map((ty) => ({ value: String(ty.id), label: operationTypeLabel(ty, i18n.language) })),
    [types, i18n.language]
  )
  const years = useMemo(
    () =>
      [...new Set(rows.map((r) => String(r.performed_on || '').slice(0, 4)).filter(Boolean))].sort().reverse(),
    [rows]
  )
  const months = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((r) => String(r.performed_on || '').slice(0, 7))
            .filter((value) => /^\d{4}-\d{2}$/.test(value))
        ),
      ]
        .filter((value) => !year || value.startsWith(year))
        .sort()
        .reverse()
        .map((value) => ({ value, label: monthLabel(value, i18n.language) })),
    [rows, year, i18n.language]
  )
  const chantierOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => (r.chantier || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .map((c) => ({ value: c, label: c })),
    [rows]
  )

  const preFiltered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (supplierId && String(row.supplier_id) !== supplierId) return false
      if (chantier && (row.chantier || '') !== chantier) return false
      if (operationTypeId) {
        const matchesType =
          String(row.operation_type_id) === operationTypeId ||
          (row.items || []).some((item) => String(item.operation_type_id) === operationTypeId)
        if (!matchesType) return false
      }
      if (year && String(row.performed_on || '').slice(0, 4) !== year) return false
      if (month && String(row.performed_on || '').slice(0, 7) !== month) return false
      if (!term) return true
      const haystack = [
        row.vehicle?.code,
        row.vehicle?.registration_plate,
        ...(row.items || []).flatMap((item) => [item.vehicle?.code, item.vehicle?.registration_plate]),
        row.supplier?.name,
        row.chantier,
        row.reference,
        row.purchase_order,
        operationTypeLabel(row.operation_type, i18n.language),
        ...(row.items || []).map((item) => operationTypeLabel(item.operation_type, i18n.language)),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [rows, search, supplierId, chantier, operationTypeId, month, year, i18n.language])

  // Counts for the BC quick filter, on everything else already filtered.
  const missingPurchaseOrders = preFiltered.filter((row) => !hasPurchaseOrder(row)).length
  const withPurchaseOrder = preFiltered.length - missingPurchaseOrders

  const filtered = useMemo(() => {
    if (bc === 'missing') return preFiltered.filter((row) => !hasPurchaseOrder(row))
    if (bc === 'present') return preFiltered.filter((row) => hasPurchaseOrder(row))
    return preFiltered
  }, [preFiltered, bc])

  const currentYear = String(new Date().getFullYear())
  // The KPI row follows the period picker: chosen month, else chosen year, else
  // the current year. Other filters (supplier, worksite, search) don't move it —
  // the cards stay a period summary of the whole module.
  const periodLabel = month ? monthLabel(month, i18n.language) : year || currentYear
  const kpiRows = useMemo(
    () =>
      rows.filter((r) => {
        const performedOn = String(r.performed_on || '')
        if (month) return performedOn.slice(0, 7) === month
        if (year) return performedOn.slice(0, 4) === year
        return performedOn.startsWith(currentYear)
      }),
    [rows, month, year, currentYear]
  )
  // Supplier cost is tracked HT; TTC is shown next to it for the cash out.
  const periodHT = kpiRows.reduce((sum, r) => sum + rowHT(r), 0)
  const periodSpend = kpiRows.reduce((sum, r) => sum + totalsOf(rowHT(r), r.vat_rate).ttc, 0)
  // Distinct suppliers actually used in the period, not the whole directory.
  const periodSuppliers = new Set(kpiRows.map((r) => r.supplier_id).filter(Boolean)).size

  // Export of exactly what the table shows (one row per article line, so the
  // sheet can be pivoted by vehicle or article). Excel is the format the
  // accounting side already works with.
  const handleExport = () => {
    if (!filtered.length) return
    const lines = filtered.flatMap((row) => {
      const rate = row.vat_rate == null ? VAT_RATE : Number(row.vat_rate)
      return rowLines(row).map((line) => {
        const vehicle = line.vehicle || row.vehicle
        const ht = Number(line.price) || 0
        const quantity = Number(line.quantity ?? 1) || 1
        const vat = round2((ht * rate) / 100)
        return {
          performed_on: formatDate(row.performed_on),
          supplier: row.supplier?.name || '',
          reference: row.reference || '',
          purchase_order: row.purchase_order || '',
          chantier: row.chantier || '',
          vehicle: vehicle?.registration_plate || vehicle?.code || '',
          article: operationTypeLabel(line.operation_type, i18n.language),
          quantity,
          unit_price: round2(line.unit_price != null ? Number(line.unit_price) : ht / quantity),
          amount_ht: ht,
          vat_amount: vat,
          total_ttc: round2(ht + vat),
        }
      })
    })

    const columns = [
      { key: 'performed_on', label: t('tachograph.performedOn') },
      { key: 'supplier', label: t('tachograph.supplier') },
      { key: 'reference', label: t('tachograph.blNo') },
      { key: 'purchase_order', label: t('tachograph.purchaseOrder') },
      { key: 'chantier', label: t('tachograph.chantier') },
      { key: 'vehicle', label: t('tachograph.vehicle') },
      { key: 'article', label: t('tachograph.items') },
      { key: 'quantity', label: t('tachograph.quantity') },
      { key: 'unit_price', label: t('tachograph.unitPriceHT') },
      { key: 'amount_ht', label: t('tachograph.amountHT') },
      { key: 'vat_amount', label: t('tachograph.vat') },
      { key: 'total_ttc', label: t('tachograph.totalTTC') },
    ]

    const filename = generateExportFilename(`SMG-Tachygraphe-${month || year || currentYear}`, 'xlsx')
    downloadFile(
      generateExcel(lines, columns, t('tachograph.operationsTitle')),
      filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    showToast(t('tachograph.exported', { count: lines.length }), 'success')
  }

  // Full detail of one operation: header facts, every line with its own
  // amounts, and the notes. Shown in a modal opened by clicking a row.
  // The line table needs width, so on phones each line becomes a card.
  const renderDetails = (row) => {
    const lines = rowLines(row)
    const rate = row.vat_rate == null ? VAT_RATE : Number(row.vat_rate)
    const totals = totalsOf(rowHT(row), rate)
    const vehicles = rowVehicles(row)

    const fields = [
      { label: t('tachograph.supplier'), value: row.supplier?.name },
      { label: t('tachograph.performedOn'), value: formatDate(row.performed_on) },
      { label: t('tachograph.chantier'), value: row.chantier },
      { label: t('tachograph.blNo'), value: row.reference },
      { label: t('tachograph.purchaseOrder'), value: row.purchase_order, missing: !hasPurchaseOrder(row) },
      { label: t('tachograph.vehicle'), vehicles },
    ]

    return (
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-3">
          {fields.map((field) => (
            <div key={field.label} className="min-w-0 bg-card px-4 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {field.label}
              </dt>
              <dd className="mt-1 text-[14px] font-medium text-foreground">
                {field.missing ? (
                  <span className="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-[12px] font-semibold text-destructive">
                    {t('tachograph.bcMissing')}
                  </span>
                ) : field.vehicles ? (
                  field.vehicles.length ? (
                    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {field.vehicles.map((vehicle) => (
                        <span key={vehicle.id} className="whitespace-nowrap">
                          {vehicle.code}
                          <span className="ml-1 font-normal text-muted-foreground">
                            {vehicle.registration_plate}
                          </span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="font-normal text-muted-foreground">—</span>
                  )
                ) : field.value ? (
                  <span className="break-words">{field.value}</span>
                ) : (
                  <span className="font-normal text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h4 className="text-[13px] font-semibold text-foreground">{t('tachograph.items')}</h4>
            <span className="text-[12px] text-muted-foreground">
              {t('tachograph.articleCount', { n: lines.length })}
            </span>
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full min-w-[620px] text-[13px]">
              <thead className="bg-muted/40">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t('tachograph.items')}</th>
                  <th className="px-3 py-2 font-medium">{t('tachograph.vehicle')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('tachograph.quantity')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('tachograph.unitPriceHT')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('tachograph.amountHT')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('tachograph.vat')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('tachograph.totalTTC')}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const lineTotals = totalsOf(line.price, rate)
                  const vehicle = line.vehicle || row.vehicle
                  return (
                    <tr key={line.id ?? index} className="border-t border-border/60">
                      <td className="px-3 py-2 text-foreground">
                        {operationTypeLabel(line.operation_type, i18n.language) || '—'}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {vehicle ? (
                          <span>
                            {vehicle.code}
                            <span className="ml-1 text-[12px] text-muted-foreground">
                              {vehicle.registration_plate}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(line.quantity)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(Number(line.unit_price ?? line.price ?? 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(lineTotals.ht)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(lineTotals.vat)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(lineTotals.ttc)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-semibold text-foreground">
                  <td className="px-3 py-2" colSpan={4}>
                    {t('tachograph.itemsTotalHT')}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.ht)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.vat)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.ttc)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="overflow-hidden rounded-lg border border-border md:hidden">
            <ul className="divide-y divide-border">
              {lines.map((line, index) => {
                const lineTotals = totalsOf(line.price, rate)
                const vehicle = line.vehicle || row.vehicle
                return (
                  <li key={line.id ?? index} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground">
                          {operationTypeLabel(line.operation_type, i18n.language) || '—'}
                        </p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          {vehicle ? `${vehicle.code} · ${vehicle.registration_plate}` : '—'}
                        </p>
                        <p className="mt-1 text-[12px] tabular-nums text-muted-foreground">
                          {formatQty(line.quantity)} ×{' '}
                          {formatCurrency(Number(line.unit_price ?? line.price ?? 0))}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[13px] font-semibold tabular-nums text-foreground">
                          {formatCurrency(lineTotals.ht)}
                        </p>
                        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                          {t('tachograph.totalTTC')} {formatCurrency(lineTotals.ttc)}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            <dl className="space-y-1 border-t border-border bg-muted/30 px-4 py-3 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t('tachograph.amountHT')}</dt>
                <dd className="tabular-nums text-foreground">{formatCurrency(totals.ht)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t('tachograph.vatWithRate', { rate })}</dt>
                <dd className="tabular-nums text-foreground">{formatCurrency(totals.vat)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 font-semibold">
                <dt className="text-foreground">{t('tachograph.totalTTC')}</dt>
                <dd className="tabular-nums text-foreground">{formatCurrency(totals.ttc)}</dd>
              </div>
            </dl>
          </div>
        </section>

        {row.notes ? (
          <section>
            <h4 className="text-[13px] font-semibold text-foreground">{t('common.notes')}</h4>
            <p className="mt-1 whitespace-pre-line break-words text-[14px] text-muted-foreground">
              {row.notes}
            </p>
          </section>
        ) : null}
      </div>
    )
  }

  const columns = [
    {
      key: 'reference',
      label: t('tachograph.blNo'),
      sortable: true,
      render: (row) =>
        row.reference ? (
          <span className="font-medium text-foreground">{row.reference}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'purchase_order',
      label: t('tachograph.purchaseOrderShort'),
      sortable: true,
      render: (row) => {
        if (hasPurchaseOrder(row)) return <span className="text-foreground">{row.purchase_order}</span>
        const age = ageInDays(row)
        return (
          <span
            title={age > 0 ? t('tachograph.notifDaysLate', { count: age }) : undefined}
            className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive"
          >
            {t('tachograph.bcMissing')}
          </span>
        )
      },
    },
    {
      key: 'performed_on',
      label: t('tachograph.performedOn'),
      sortable: true,
      render: (row) => formatDate(row.performed_on),
    },
    {
      key: 'vehicle',
      label: t('tachograph.vehicle'),
      render: (row) => {
        const list = rowVehicles(row)
        if (!list.length) return <span className="text-muted-foreground">—</span>
        const [first, ...rest] = list
        return (
          <div title={list.map((v) => `${v.code} — ${v.registration_plate}`).join('\n')}>
            <p className="font-medium text-foreground">{first.code}</p>
            <p className="text-[12px] text-muted-foreground">
              {first.registration_plate}
              {rest.length ? (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                  +{rest.length}
                </span>
              ) : null}
            </p>
          </div>
        )
      },
    },
    {
      key: 'supplier',
      label: t('tachograph.supplier'),
      render: (row) => row.supplier?.name || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'chantier',
      label: t('tachograph.chantier'),
      render: (row) =>
        row.chantier ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium text-foreground">
            {row.chantier}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'items',
      label: t('tachograph.items'),
      render: (row) => {
        const names = rowLines(row)
          .map((line) => operationTypeLabel(line.operation_type, i18n.language))
          .filter(Boolean)
        if (!names.length) return <span className="text-muted-foreground">—</span>
        if (names.length === 1) return names[0]
        return (
          <span className="text-muted-foreground">
            {t('tachograph.articleCount', { n: names.length })}
          </span>
        )
      },
    },
    {
      key: 'price_paid',
      label: t('tachograph.amountHT'),
      sortable: true,
      render: (row) => {
        if (row.price_paid == null && !row.items?.length) {
          return <span className="text-muted-foreground">—</span>
        }
        return <span className="tabular-nums">{formatCurrency(rowHT(row))}</span>
      },
    },
    {
      key: 'total_ttc',
      label: t('tachograph.totalTTC'),
      render: (row) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(totalsOf(rowHT(row), row.vat_rate).ttc)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setViewing(row)
            }}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('tachograph.operationDetails')}
            title={t('tachograph.operationDetails')}
          >
            <Eye {...SF} className="h-4 w-4" />
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openEdit(row)
              }}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t('common.edit')}
            >
              <Edit {...SF} className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDeleting(row)
              }}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label={t('common.delete')}
            >
              <Trash {...SF} className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  if (loading) return <PageSpinner message={t('common.loading')} />

  if (error) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle {...SF} className="h-8 w-8 text-destructive" />
          <p className="text-[15px] font-medium text-foreground">{t('tachograph.loadFailed')}</p>
          <Button variant="outline" onClick={() => setRetryKey((k) => k + 1)}>
            {t('ui.retry')}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <TachographTabs />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('tachograph.operationsTitle')}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!filtered.length}>
            <Download {...SF} className="h-4 w-4" />
            {t('common.export')}
          </Button>
          {canCreate && (
            <Button onClick={() => openCreate()}>
              <Plus {...SF} className="h-4 w-4" />
              {t('tachograph.newOperation')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t('tachograph.kpiOperations', { period: periodLabel })}
          value={kpiRows.length}
          icon={Tool01}
          iconClassName="bg-primary/10 text-primary"
        />
        <KpiCard
          title={t('tachograph.kpiSpendHT', { period: periodLabel })}
          value={formatCurrency(periodHT)}
          icon={Coins01}
          iconClassName="bg-primary/10 text-primary"
        />
        <KpiCard
          title={t('tachograph.kpiSpend', { period: periodLabel })}
          value={formatCurrency(periodSpend)}
          icon={CreditCard01}
          iconClassName="bg-primary/10 text-primary"
        />
        <KpiCard
          title={t('tachograph.kpiSuppliers', { period: periodLabel })}
          value={periodSuppliers}
          icon={Building01}
          iconClassName="bg-primary/10 text-primary"
        />
      </div>

      <Card padding={false} className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
            role="group"
            aria-label={t('tachograph.bcFilterLabel')}
          >
            {[
              { value: '', label: t('tachograph.bcFilterAll'), count: preFiltered.length },
              { value: 'missing', label: t('tachograph.bcFilterMissing'), count: missingPurchaseOrders },
              { value: 'present', label: t('tachograph.bcFilterPresent'), count: withPurchaseOrder },
            ].map((option) => {
              const active = bc === option.value
              const alert = option.value === 'missing' && option.count > 0
              return (
                <button
                  key={option.value || 'all'}
                  type="button"
                  onClick={() => setBc(option.value)}
                  aria-pressed={active}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option.label}
                  <span
                    className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                      alert ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {option.count}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-[12px] text-muted-foreground">
            {t('tachograph.filteredCount', { count: filtered.length })}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input
            placeholder={t('tachograph.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            showAll
            allLabel={t('tachograph.allSuppliers')}
            placeholder={t('tachograph.allSuppliers')}
            options={supplierOptions}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          />
          <Select
            showAll
            allLabel={t('tachograph.allChantiers')}
            placeholder={t('tachograph.allChantiers')}
            options={chantierOptions}
            value={chantier}
            onChange={(e) => setChantier(e.target.value)}
          />
          <Select
            showAll
            allLabel={t('tachograph.allOperations')}
            placeholder={t('tachograph.allOperations')}
            options={typeOptions}
            value={operationTypeId}
            onChange={(e) => setOperationTypeId(e.target.value)}
          />
          <Select
            showAll
            allLabel={t('tachograph.allMonths')}
            placeholder={t('tachograph.month')}
            options={months}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <Select
            showAll
            allLabel={t('tachograph.allYears')}
            placeholder={t('tachograph.year')}
            options={years.map((y) => ({ value: y, label: y }))}
            value={year}
            onChange={(e) => {
              setYear(e.target.value)
              setMonth('')
            }}
          />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tool01}
            title={t('tachograph.noOperations')}
            description={t('tachograph.noOperationsDesc')}
            action={
              canCreate ? (
                <Button onClick={() => openCreate()}>
                  <Plus {...SF} className="h-4 w-4" />
                  {t('tachograph.newOperation')}
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <Table
          columns={columns}
          data={filtered}
          emptyMessage={t('ui.noData')}
          onRowClick={setViewing}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? t('tachograph.editOperation') : t('tachograph.newOperation')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? t('common.update') : t('common.create')}
            </Button>
          </>
        }
      >
        {linkedDemand && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-3">
            <FileCheck01 {...SF} className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 text-[13px] text-foreground">
              <p className="font-semibold">
                {t('tachograph.demandFromDemand', { reference: linkedDemand.reference })}
              </p>
              {(linkedDemand.items || []).length > 0 && (
                <p className="mt-0.5 text-muted-foreground">
                  {[...new Set((linkedDemand.items || []).map((item) => item.kind))]
                    .map(demandKindLabel)
                    .join(' · ')}
                </p>
              )}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('tachograph.supplier')}
            required
            options={supplierOptions}
            placeholder={t('tachograph.pickSupplier')}
            value={form.supplier_id}
            onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
          />
          <Input
            label={t('tachograph.performedOn')}
            type="date"
            required
            value={form.performed_on}
            onChange={(e) => setForm({ ...form, performed_on: e.target.value })}
          />
          <div>
            <Input
              label={t('tachograph.chantier')}
              list="tacho-chantiers"
              autoComplete="off"
              value={form.chantier}
              onChange={(e) => setForm({ ...form, chantier: e.target.value })}
              placeholder={t('tachograph.chantierPlaceholder')}
            />
            <datalist id="tacho-chantiers">
              {chantierOptions.map((option) => (
                <option key={option.value} value={option.value} />
              ))}
            </datalist>
          </div>
          <Input
            label={t('tachograph.deliveryNote')}
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder={t('tachograph.deliveryNotePlaceholder')}
          />
          <Input
            label={t('tachograph.purchaseOrder')}
            value={form.purchase_order}
            onChange={(e) => setForm({ ...form, purchase_order: e.target.value })}
            placeholder={t('tachograph.purchaseOrderPlaceholder')}
          />
          <div className="sm:col-span-2">
            <Input
              label={t('common.notes')}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t('common.optionalNotes')}
            />
          </div>

          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-[13px] font-medium text-muted-foreground">
                {t('tachograph.items')}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus {...SF} className="h-4 w-4" />
                {t('tachograph.addItem')}
              </Button>
            </div>
            <p className="mb-2 text-[12px] text-muted-foreground">{t('tachograph.lineHint')}</p>
            <datalist id="tacho-vehicle-plates">
              {vehicles.map((v) => (
                <option key={v.id} value={v.registration_plate || ''}>
                  {v.code}
                </option>
              ))}
            </datalist>
            <datalist id="tacho-article-types">
              {types.map((ty) => (
                <option key={ty.id} value={operationTypeLabel(ty, i18n.language)} />
              ))}
            </datalist>
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={index} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Input
                        list="tacho-article-types"
                        autoComplete="off"
                        value={item.type_query}
                        onChange={(e) => patchItemType(index, e.target.value)}
                        placeholder={t('tachograph.pickOperation')}
                        aria-label={t('tachograph.items')}
                        error={
                          item.type_query && !item.operation_type_id
                            ? t('tachograph.articleNotFound')
                            : undefined
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => duplicateItem(index)}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={t('tachograph.duplicateLine')}
                      title={t('tachograph.duplicateLine')}
                    >
                      <Duplicate {...SF} className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={form.items.length === 1}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={t('common.delete')}
                      title={t('common.delete')}
                    >
                      <Trash {...SF} className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_8rem]">
                    <Input
                      list="tacho-vehicle-plates"
                      autoComplete="off"
                      value={item.vehicle_query}
                      onChange={(e) => patchItemVehicle(index, e.target.value)}
                      placeholder={t('tachograph.vehiclePlate')}
                      aria-label={t('tachograph.vehiclePlate')}
                      error={
                        item.vehicle_query && !item.vehicle_id
                          ? t('tachograph.vehicleNotFound')
                          : undefined
                      }
                    />
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: e.target.value })}
                      placeholder={t('tachograph.quantity')}
                      aria-label={t('tachograph.quantity')}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, { unit_price: e.target.value })}
                      placeholder={t('tachograph.unitPriceHT')}
                      aria-label={t('tachograph.unitPriceHT')}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-end gap-2 text-[12px]">
                    <span className="text-muted-foreground">{t('tachograph.lineTotal')}</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(itemTotal(item))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t('tachograph.totalHT')}</span>
                <span className="tabular-nums text-foreground">{formatCurrency(formTotals.ht)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t('tachograph.vatWithRate', { rate: VAT_RATE })}</span>
                <span className="tabular-nums text-foreground">{formatCurrency(formTotals.vat)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 font-semibold">
                <span className="text-foreground">{t('tachograph.totalTTC')}</span>
                <span className="tabular-nums text-foreground">{formatCurrency(formTotals.ttc)}</span>
              </div>
            </div>
          </div>

        </div>
      </Modal>

      {/* Read-only detail of one operation, opened by clicking a row. A modal
          keeps the list compact and shows every line at a glance. */}
      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title={t('tachograph.operationDetails')}
        description={
          viewing
            ? [viewing.reference, formatDate(viewing.performed_on)].filter(Boolean).join(' · ')
            : undefined
        }
        size="xl"
        scrollable
        headerCls="flex items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6"
        bodyCls="p-5 sm:p-6"
        footerCls="flex items-center justify-end gap-3 border-t border-border px-5 py-4 sm:px-6"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewing(null)}>
              {t('common.close')}
            </Button>
            {canEdit && viewing && (
              <Button
                onClick={() => {
                  const row = viewing
                  setViewing(null)
                  openEdit(row)
                }}
              >
                <Edit {...SF} className="h-4 w-4" />
                {t('common.edit')}
              </Button>
            )}
          </>
        }
      >
        {viewing ? renderDetails(viewing) : null}
      </Modal>

      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={t('tachograph.deleteOperation')}
        message={t('tachograph.deleteOperationConfirm', {
          vehicle: deleting?.vehicle ? `${deleting.vehicle.code} — ${deleting.vehicle.registration_plate}` : '—',
        })}
        loading={deletingBusy}
      />
    </div>
  )
}
