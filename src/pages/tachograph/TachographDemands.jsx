import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Printer,
  Trash01 as Trash,
  Edit01 as Edit,
  FileCheck01,
  Clock,
  CheckCircle,
  Truck01,
  AlertTriangle,
} from '@untitledui/icons'
import { tachographApi, vehiclesApi } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/formatters'
import { downloadFile, generateExportFilename } from '../../utils/parsers'
import { generateDemandPdf } from '../../utils/tachographDemandPdf'
import { todayISO } from '../../utils/tachograph'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Card from '../../components/ui/Card'
import KpiCard from '../../components/ui/KpiCard'
import Table from '../../components/ui/Table'
import Modal, { ConfirmModal } from '../../components/ui/Modal'
import { PageSpinner } from '../../components/ui/Spinner'
import TachographTabs from './TachographTabs'

const SF = { strokeWidth: 1.75, fill: 'none' }

const STATUS_KEYS = {
  open: 'tachograph.demandStatusOpen',
  done: 'tachograph.demandStatusDone',
  closed: 'tachograph.demandStatusClosed',
}

const STATUS_CLASSES = {
  open: 'bg-warning/10 text-warning',
  done: 'bg-primary/10 text-primary',
  closed: 'bg-success/10 text-success',
}

// A demand that carries an operation is completed: the operation is what
// fulfils it. Deriving the status keeps the list honest even when the stored
// value lags behind (older rows, a link written outside the app).
const demandStatus = (row) =>
  row?.operation_id && row?.status !== 'closed' ? 'closed' : row?.status || 'open'

// Toast shown once a status change lands.
const STATUS_TOAST_KEYS = {
  done: 'tachograph.demandMarkedDone',
  closed: 'tachograph.demandMarkedClosed',
}

// A demand line only says what the vehicle needs: a repair or a periodic
// inspection. The precise operation is chosen later, when it is logged.
const KIND_KEYS = {
  reparation: 'tachograph.demandKindRepair',
  visite_periodique: 'tachograph.demandKindPeriodic',
}

const emptyItem = (vehicleId = '', vehiclePlate = '') => ({
  kind: 'reparation',
  vehicle_id: vehicleId ? String(vehicleId) : '',
  vehicle_query: vehiclePlate,
})

const emptyForm = () => ({
  requested_on: todayISO(),
  requested_by: '',
  chantier: '',
  notes: '',
  items: [emptyItem()],
})

// One demand can cover several vehicles: the sheet lists one line per vehicle.
const demandVehicles = (demand) => {
  const seen = new Map()
  for (const item of demand.items || []) {
    const vehicle = item.vehicle
    if (vehicle?.id != null && !seen.has(vehicle.id)) seen.set(vehicle.id, vehicle)
  }
  return [...seen.values()]
}

export default function TachographDemands() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { can, user } = useAuth()
  const navigate = useNavigate()

  // A requester holds `addTachographDemands`: send, correct and withdraw their
  // own demands. Operations users keep the same abilities through their
  // operations scopes, since turning a demand into an operation is done here.
  const canCreate = can('addTachographDemands') || can('addTachograph')
  const canEdit = can('addTachographDemands') || can('editTachograph')
  const canDelete = can('addTachographDemands') || can('deleteTachograph')
  // Logging the operation itself stays an operations-book action: a requester
  // must never be handed the operations page.
  const canCreateOperation = can('addTachograph')
  // Fleet manager: sees every demand. Everyone else only sees their own.
  const canViewAll = can('viewAllTachographDemands')
  // The requester is anyone allowed to raise a demand: they mark it "Traité"
  // once the operation is logged. The fleet manager finalises it "Terminé".
  const canMarkDone = canCreate || canEdit

  const [rows, setRows] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [demandRows, vehicleRows] = await Promise.all([
        // RLS enforces the same rule; passing the owner keeps the query small.
        tachographApi.listDemands(canViewAll ? {} : { createdBy: user?.auth_id }),
        vehiclesApi.listKeys(),
      ])
      setRows(demandRows || [])
      setVehicles(vehicleRows || [])
    } catch (e) {
      console.error('Error loading tachograph demands:', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [canViewAll, user?.auth_id])

  useEffect(() => {
    load()
  }, [load, retryKey])

  const kindLabel = useCallback(
    (kind) => t(KIND_KEYS[kind] || KIND_KEYS.reparation),
    [t]
  )

  const kindOptions = useMemo(
    () =>
      Object.entries(KIND_KEYS).map(([value, labelKey]) => ({
        value,
        label: t(labelKey),
      })),
    [t]
  )

  const chantierOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => (r.chantier || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .map((c) => ({ value: c, label: c })),
    [rows]
  )

  const statusCounts = useMemo(() => {
    const counts = { total: 0, open: 0, done: 0, closed: 0 }
    for (const row of rows) {
      counts.total += 1
      const status = demandStatus(row)
      if (counts[status] != null) counts[status] += 1
    }
    return counts
  }, [rows])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (status && demandStatus(row) !== status) return false
      if (!term) return true
      const haystack = [
        row.reference,
        row.chantier,
        row.requested_by,
        ...(row.items || []).flatMap((item) => [
          item.vehicle?.code,
          item.vehicle?.registration_plate,
          kindLabel(item.kind),
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [rows, search, status, kindLabel])

  const matchVehicle = useCallback(
    (value) => {
      const term = String(value || '').trim().toLowerCase()
      if (!term) return null
      return (
        vehicles.find((v) => String(v.registration_plate || '').trim().toLowerCase() === term) ||
        vehicles.find((v) => String(v.code || '').trim().toLowerCase() === term) ||
        null
      )
    },
    [vehicles]
  )

  const updateItem = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  const patchItemVehicle = (index, value) => {
    const match = matchVehicle(value)
    updateItem(index, { vehicle_query: value, vehicle_id: match ? String(match.id) : '' })
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

  const openCreate = useCallback(() => {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }, [])

  const openEdit = (demand) => {
    const items = [...(demand.items || [])].sort((a, b) => (a.id || 0) - (b.id || 0))
    setEditing(demand)
    setForm({
      requested_on: demand.requested_on || todayISO(),
      requested_by: demand.requested_by || '',
      chantier: demand.chantier || '',
      notes: demand.notes || '',
      items: items.length
        ? items.map((item) => ({
            kind: item.kind || 'reparation',
            vehicle_id: item.vehicle_id ? String(item.vehicle_id) : '',
            vehicle_query: item.vehicle?.registration_plate || '',
          }))
        : [emptyItem()],
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm())
  }

  const handleSave = async () => {
    const items = form.items
      .filter((item) => item.vehicle_id)
      .map((item) => ({ vehicle_id: item.vehicle_id, kind: item.kind }))

    if (!items.length) {
      showToast(t('tachograph.demandItemsRequired'), 'error')
      return
    }
    if (form.items.some((item) => item.vehicle_query && !item.vehicle_id)) {
      showToast(t('tachograph.vehicleNotFound'), 'error')
      return
    }
    if (!form.requested_on) {
      showToast(t('tachograph.requiredFields'), 'error')
      return
    }

    const payload = {
      requested_on: form.requested_on,
      chantier: form.chantier,
      requested_by: form.requested_by,
      notes: form.notes,
      items,
    }

    setSaving(true)
    try {
      if (editing) {
        await tachographApi.updateDemand(editing.id, payload)
      } else {
        await tachographApi.createDemand(payload)
      }
      showToast(t('tachograph.demandSaved'), 'success')
      setModalOpen(false)
      setEditing(null)
      setForm(emptyForm())
      load()
    } catch (e) {
      console.error('Error saving tachograph demand:', e)
      showToast(t('tachograph.demandSaveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  // The sheet the worksite keeps. Everything user-facing is translated here so
  // the PDF follows the active UI language.
  const handlePrint = (demand) => {
    try {
      const labels = {
        company: 'SMG Fleet',
        subtitle: t('tachograph.demandPdfSubtitle'),
        date: t('tachograph.demandPdfDate'),
        worksite: t('tachograph.chantier'),
        vehicles: t('tachograph.demandVehicles'),
        requestedBy: t('tachograph.demandRequestedBy'),
        articles: t('tachograph.demandPdfArticles'),
        kind: t('tachograph.demandKindLabel'),
        vehicle: t('tachograph.vehicle'),
        noArticles: t('tachograph.demandPdfNoArticles'),
        notes: t('tachograph.demandPdfNotes'),
        bl: t('tachograph.blNo'),
        bc: t('tachograph.purchaseOrder'),
        signRequester: t('tachograph.demandPdfSignRequester'),
        signReceiver: t('tachograph.demandPdfSignReceiver'),
        generated: t('tachograph.demandPdfGenerated'),
        kindLabel,
      }
      const filename = generateExportFilename(`SMG-Demande-${demand.reference}`, 'pdf')
      downloadFile(generateDemandPdf({ demand, labels }), filename, 'application/pdf')
      showToast(t('tachograph.demandPdfReady'), 'success')
    } catch (e) {
      console.error('Error generating the demand PDF:', e)
      showToast(t('tachograph.demandPdfFailed'), 'error')
    }
  }

  const changeStatus = async (demand, nextStatus) => {
    setBusy(true)
    try {
      await tachographApi.setDemandStatus(demand.id, nextStatus)
      const next = { ...demand, status: nextStatus }
      setRows((prev) => prev.map((row) => (row.id === demand.id ? next : row)))
      setViewing((prev) => (prev && prev.id === demand.id ? next : prev))
      showToast(t(STATUS_TOAST_KEYS[nextStatus] || 'tachograph.demandSaveFailed'), 'success')
    } catch (e) {
      console.error('Error updating the demand status:', e)
      showToast(t('tachograph.demandSaveFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const submitDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await tachographApi.deleteDemand(deleting.id)
      showToast(t('tachograph.demandDeleted'), 'success')
      setDeleting(null)
      setViewing(null)
      load()
    } catch (e) {
      console.error('Error deleting the demand:', e)
      showToast(t('tachograph.demandDeleteFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const statusBadge = (value) => (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        STATUS_CLASSES[value] || STATUS_CLASSES.open
      }`}
    >
      {t(STATUS_KEYS[value] || STATUS_KEYS.open)}
    </span>
  )

  const columns = [
    {
      key: 'reference',
      label: t('tachograph.demandReference'),
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-semibold text-foreground">{row.reference}</p>
          <p className="text-[12px] text-muted-foreground">{formatDate(row.requested_on)}</p>
        </div>
      ),
    },
    {
      key: 'vehicle',
      label: t('tachograph.demandVehicles'),
      render: (row) => {
        const list = demandVehicles(row)
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
      key: 'kind',
      label: t('tachograph.demandKindLabel'),
      render: (row) => {
        const kinds = [...new Set((row.items || []).map((item) => item.kind || 'reparation'))]
        if (!kinds.length) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {kinds.map((kind) => (
              <span
                key={kind}
                className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
              >
                {kindLabel(kind)}
              </span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'chantier',
      label: t('tachograph.chantier'),
      render: (row) =>
        row.chantier ? (
          <span className="text-foreground">{row.chantier}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'requested_by',
      label: t('tachograph.demandRequestedBy'),
      render: (row) =>
        row.requested_by ? (
          <span className="text-foreground">{row.requested_by}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      label: t('tachograph.demandStatusLabel'),
      render: (row) => statusBadge(demandStatus(row)),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handlePrint(row)
          }}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t('tachograph.demandPrint')}
          title={t('tachograph.demandPrint')}
        >
          <Printer {...SF} className="h-4 w-4" />
        </button>
      ),
    },
  ]

  if (loading) return <PageSpinner message={t('common.loading')} />

  if (error) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle {...SF} className="h-8 w-8 text-destructive" />
          <p className="text-[15px] font-medium text-foreground">{t('tachograph.demandLoadFailed')}</p>
          <Button variant="outline" onClick={() => setRetryKey((k) => k + 1)}>
            {t('ui.retry')}
          </Button>
        </div>
      </Card>
    )
  }

  const viewedLines = viewing?.items || []

  return (
    <div className="space-y-6">
      <TachographTabs />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('tachograph.demandsTitle')}
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">{t('tachograph.demandsSubtitle')}</p>
          {!canViewAll && (
            <p className="mt-1 text-[13px] text-muted-foreground">{t('tachograph.demandsOwnOnly')}</p>
          )}
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus {...SF} className="h-4 w-4" />
            {t('tachograph.newDemand')}
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t('tachograph.demandKpiTotal')}
          value={statusCounts.total}
          icon={FileCheck01}
          iconClassName="bg-primary/10 text-primary"
        />
        <KpiCard
          title={t('tachograph.demandKpiOpen')}
          value={statusCounts.open}
          icon={Clock}
          iconClassName="bg-warning/10 text-warning"
        />
        <KpiCard
          title={t('tachograph.demandKpiDone')}
          value={statusCounts.done}
          icon={CheckCircle}
          iconClassName="bg-primary/10 text-primary"
        />
        <KpiCard
          title={t('tachograph.demandKpiClosed')}
          value={statusCounts.closed}
          icon={CheckCircle}
          iconClassName="bg-success/10 text-success"
        />
      </div>

      <Card padding={false} className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
            role="group"
            aria-label={t('tachograph.demandStatusLabel')}
          >
            {[
              { value: '', label: t('tachograph.demandFilterAll'), count: statusCounts.total },
              { value: 'open', label: t('tachograph.demandStatusOpen'), count: statusCounts.open },
              { value: 'done', label: t('tachograph.demandStatusDone'), count: statusCounts.done },
              {
                value: 'closed',
                label: t('tachograph.demandStatusClosed'),
                count: statusCounts.closed,
              },
            ].map((option) => {
              const active = status === option.value
              return (
                <button
                  key={option.value || 'all'}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  aria-pressed={active}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option.label}
                  <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                    {option.count}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-[12px] text-muted-foreground">
            {t('tachograph.demandCount', { count: filtered.length })}
          </p>
        </div>

        <Input
          placeholder={t('tachograph.demandSearchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <Table
        columns={columns}
        data={filtered}
        emptyMessage={t('tachograph.demandEmpty')}
        onRowClick={setViewing}
      />

      {/* Create / edit: the request itself — a vehicle, and what it needs. */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? t('tachograph.editDemand') : t('tachograph.newDemand')}
        size="xl"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('tachograph.demandRequestedOn')}
            type="date"
            required
            value={form.requested_on}
            onChange={(e) => setForm({ ...form, requested_on: e.target.value })}
          />
          <Input
            label={t('tachograph.demandRequestedBy')}
            value={form.requested_by}
            onChange={(e) => setForm({ ...form, requested_by: e.target.value })}
            placeholder={t('tachograph.demandRequestedByPlaceholder')}
          />
          <div>
            <Input
              label={t('tachograph.chantier')}
              list="demand-chantiers"
              autoComplete="off"
              value={form.chantier}
              onChange={(e) => setForm({ ...form, chantier: e.target.value })}
              placeholder={t('tachograph.chantierPlaceholder')}
            />
            <datalist id="demand-chantiers">
              {chantierOptions.map((option) => (
                <option key={option.value} value={option.value} />
              ))}
            </datalist>
          </div>
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
                {t('tachograph.demandLines')}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus {...SF} className="h-4 w-4" />
                {t('tachograph.demandAddLine')}
              </Button>
            </div>
            <p className="mb-2 text-[12px] text-muted-foreground">{t('tachograph.demandLineHint')}</p>
            <datalist id="demand-vehicle-plates">
              {vehicles.map((v) => (
                <option key={v.id} value={v.registration_plate || ''}>
                  {v.code}
                </option>
              ))}
            </datalist>
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={index} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Select
                        options={kindOptions}
                        value={item.kind}
                        onChange={(e) => updateItem(index, { kind: e.target.value })}
                        aria-label={t('tachograph.demandKindLabel')}
                      />
                    </div>
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
                  <div className="mt-2">
                    <Input
                      list="demand-vehicle-plates"
                      autoComplete="off"
                      value={item.vehicle_query}
                      onChange={(e) => patchItemVehicle(index, e.target.value)}
                      placeholder={t('tachograph.vehiclePlatePlaceholder')}
                      aria-label={t('tachograph.vehiclePlate')}
                      error={
                        item.vehicle_query && !item.vehicle_id
                          ? t('tachograph.vehicleNotFound')
                          : undefined
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Detail: what the worksite asked for, and the next step. */}
      <Modal
        isOpen={!!viewing}
        onClose={() => !busy && setViewing(null)}
        title={viewing ? viewing.reference : ''}
        description={viewing ? formatDate(viewing.requested_on) : ''}
        size="xl"
        scrollable
        bodyCls="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 text-muted-foreground"
        footerCls="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
        footer={
          viewing ? (
            <>
              {canDelete ? (
                <Button
                  variant="dangerOutline"
                  size="sm"
                  onClick={() => setDeleting(viewing)}
                  disabled={busy}
                  className="w-full sm:w-auto"
                >
                  <Trash {...SF} className="h-4 w-4" />
                  {t('common.delete')}
                </Button>
              ) : (
                <span className="hidden sm:block" />
              )}
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrint(viewing)}
                  className="flex-1 sm:flex-none"
                >
                  <Printer {...SF} className="h-4 w-4" />
                  {t('tachograph.demandPrint')}
                </Button>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const demand = viewing
                      setViewing(null)
                      openEdit(demand)
                    }}
                    className="flex-1 sm:flex-none"
                  >
                    <Edit {...SF} className="h-4 w-4" />
                    {t('common.edit')}
                  </Button>
                )}
                {/* The requester marks the demand processed (Traité)… */}
                {demandStatus(viewing) === 'open' && canMarkDone && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy}
                    onClick={() => changeStatus(viewing, 'done')}
                    className="flex-1 sm:flex-none"
                  >
                    <CheckCircle {...SF} className="h-4 w-4" />
                    {t('tachograph.demandMarkDone')}
                  </Button>
                )}
                {/* …then the fleet manager finalises it (Terminé). */}
                {demandStatus(viewing) === 'done' && canEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy}
                    onClick={() => changeStatus(viewing, 'closed')}
                    className="flex-1 sm:flex-none"
                  >
                    <CheckCircle {...SF} className="h-4 w-4" />
                    {t('tachograph.demandMarkClosed')}
                  </Button>
                )}
              </div>
            </>
          ) : null
        }
      >
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(demandStatus(viewing))}
              {viewing.operation_id ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  <Truck01 {...SF} className="h-3 w-3" />
                  {t('tachograph.demandOperationDone')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  <Clock {...SF} className="h-3 w-3" />
                  {t('tachograph.demandNoOperation')}
                </span>
              )}
            </div>

            <dl className="grid gap-x-6 gap-y-4 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('tachograph.chantier')}
                </dt>
                <dd className="mt-0.5 text-[14px] font-medium text-foreground">
                  {viewing.chantier || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('tachograph.demandRequestedBy')}
                </dt>
                <dd className="mt-0.5 text-[14px] font-medium text-foreground">
                  {viewing.requested_by || '—'}
                </dd>
              </div>
              {viewing.operation_id ? (
                <>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('tachograph.blNo')}
                    </dt>
                    <dd className="mt-0.5 text-[14px] font-medium text-foreground">
                      {viewing.operation?.reference || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('tachograph.purchaseOrder')}
                    </dt>
                    <dd className="mt-0.5 text-[14px] font-medium text-foreground">
                      {viewing.operation?.purchase_order || '—'}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>

            <section>
              <h4 className="mb-2 text-[13px] font-semibold text-foreground">
                {t('tachograph.demandLines')}
              </h4>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="min-w-full">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('tachograph.demandKindLabel')}
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('tachograph.vehicle')}
                      </th>
                    </tr>
                  </thead>
                  <tbody style={{ borderTop: '1px solid hsl(var(--border))' }}>
                    {viewedLines.map((line, index) => (
                      <tr
                        key={line.id ?? index}
                        style={{ borderBottom: '1px solid hsl(var(--border))' }}
                      >
                        <td className="px-3 py-2 text-[14px] text-foreground">
                          {kindLabel(line.kind)}
                        </td>
                        <td className="px-3 py-2 text-[14px] text-foreground">
                          {line.vehicle ? (
                            <span>
                              <span className="font-medium">{line.vehicle.code}</span>
                              <span className="ml-1.5 text-[12px] text-muted-foreground">
                                {line.vehicle.registration_plate}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {viewing.notes ? (
              <section>
                <h4 className="text-[13px] font-semibold text-foreground">{t('common.notes')}</h4>
                <p className="mt-1 whitespace-pre-line break-words text-[14px] text-muted-foreground">
                  {viewing.notes}
                </p>
              </section>
            ) : null}

            {/* No operation yet: hand the demand to the operations book. */}
            {canCreateOperation && !viewing.operation_id && (
              <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {t('tachograph.demandNoOperation')}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {t('tachograph.demandCreateOperationHint')}
                  </p>
                </div>
                <Button
                  onClick={() => navigate(`/tachograph?new=1&demand=${viewing.id}`)}
                  className="shrink-0"
                >
                  <Truck01 {...SF} className="h-4 w-4" />
                  {t('tachograph.demandCreateOperation')}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => !busy && setDeleting(null)}
        onConfirm={submitDelete}
        title={t('tachograph.demandDeleteTitle')}
        message={t('tachograph.demandDeleteConfirm', { reference: deleting?.reference || '' })}
        confirmText={t('common.delete')}
        loading={busy}
      />
    </div>
  )
}
