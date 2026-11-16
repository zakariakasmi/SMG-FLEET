import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Edit01 as Edit,
  Trash01 as Trash,
  Building01,
  Phone,
  Mail01 as Mail,
  Coins01,
  XClose,
} from '@untitledui/icons'
import { tachographApi } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useUnsaved } from '../../components/ui/UnsavedChangesGuard'
import { operationTypeLabel } from '../../utils/tachograph'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import Modal, { ConfirmModal } from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import { PageSpinner } from '../../components/ui/Spinner'

const SF = { strokeWidth: 1.75, fill: 'none' }

const emptyForm = () => ({
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  active: true,
})

// Settings tab for the garages/tachograph centres the fleet works with,
// including per-supplier unit prices for each tachograph item.
export default function TachographSuppliersTab() {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const { isAdmin, can } = useAuth()
  const { setDirty, markSaved } = useUnsaved()

  const canCreate = can('addTachograph')
  const canEdit = can('editTachograph')
  const canDelete = can('deleteTachograph')
  const canManagePrices = isAdmin || can('addTachograph') || can('editTachograph') || can('manageTypes')

  const [suppliers, setSuppliers] = useState([])
  const [operationTypes, setOperationTypes] = useState([])
  const [tariffs, setTariffs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  const [pricesSupplier, setPricesSupplier] = useState(null)
  const [priceDrafts, setPriceDrafts] = useState({})
  const [priceBaseline, setPriceBaseline] = useState({})
  const [savingPrices, setSavingPrices] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [supplierRows, typeRows, tariffRows] = await Promise.all([
        tachographApi.listSuppliers(),
        tachographApi.listOperationTypes(),
        tachographApi.listTariffs(),
      ])
      setSuppliers(supplierRows || [])
      setOperationTypes(typeRows || [])
      setTariffs(tariffRows || [])
    } catch (e) {
      console.error('Error loading tachograph suppliers:', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const dirty =
      Boolean(pricesSupplier) &&
      JSON.stringify(priceDrafts) !== JSON.stringify(priceBaseline)
    setDirty(dirty)
    return () => setDirty(false)
  }, [pricesSupplier, priceDrafts, priceBaseline, setDirty])

  // Latest tariff per (supplier_id, operation_type_id).
  const tariffsBySupplier = useMemo(() => {
    const map = new Map()
    for (const row of tariffs) {
      const sid = String(row.supplier_id)
      const tid = String(row.operation_type_id)
      if (!map.has(sid)) map.set(sid, new Map())
      const byType = map.get(sid)
      if (!byType.has(tid)) byType.set(tid, row)
    }
    return map
  }, [tariffs])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  const openEdit = (supplier) => {
    setEditing(supplier)
    setForm({
      name: supplier.name || '',
      contact_name: supplier.contact_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      active: supplier.active !== false,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm())
  }

  const openPrices = (supplier) => {
    const existingMap = tariffsBySupplier.get(String(supplier.id)) || new Map()
    const drafts = {}
    for (const type of operationTypes) {
      const row = existingMap.get(String(type.id))
      drafts[type.id] = {
        price: row && row.price != null ? String(Number(row.price)) : '',
        notes: row?.notes || '',
      }
    }
    setPriceBaseline(drafts)
    setPriceDrafts(drafts)
    setPricesSupplier(supplier)
  }

  const closePrices = () => {
    if (savingPrices) return
    setPricesSupplier(null)
    setPriceDrafts({})
    setPriceBaseline({})
  }

  const updatePriceDraft = (typeId, patch) => {
    setPriceDrafts((prev) => ({
      ...prev,
      [typeId]: {
        ...(prev[typeId] || { price: '', notes: '' }),
        ...patch,
      },
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast(t('tachograph.required'), 'error')
      return
    }
    try {
      setSaving(true)
      if (editing) {
        await tachographApi.updateSupplier(editing.id, form)
      } else {
        await tachographApi.createSupplier(form)
      }
      showToast(t('tachograph.supplierSaved'), 'success')
      // Reset directly: closeModal() refuses while `saving` is still true.
      setModalOpen(false)
      setEditing(null)
      setForm(emptyForm())
      load()
    } catch (e) {
      console.error('Error saving tachograph supplier:', e)
      showToast(t('tachograph.supplierSaveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePrices = async () => {
    if (!pricesSupplier) return
    const entries = operationTypes.map((type) => {
      const draft = priceDrafts[type.id] || { price: '', notes: '' }
      return {
        operation_type_id: type.id,
        price: String(draft.price ?? '').trim(),
        notes: draft.notes || '',
      }
    })

    for (const entry of entries) {
      if (entry.price !== '') {
        const num = Number(entry.price)
        if (!Number.isFinite(num) || num < 0) {
          showToast(t('tachograph.invalidPrice'), 'error')
          return
        }
      }
    }

    try {
      setSavingPrices(true)
      await tachographApi.saveSupplierTariffs(pricesSupplier.id, entries)
      markSaved()
      showToast(t('tachograph.supplierPricesSaved'), 'success')
      setPricesSupplier(null)
      setPriceDrafts({})
      setPriceBaseline({})
      load()
    } catch (e) {
      console.error('Error saving supplier tariffs:', e)
      showToast(t('tachograph.supplierPricesSaveFailed'), 'error')
    } finally {
      setSavingPrices(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      setDeletingBusy(true)
      await tachographApi.deleteSupplier(deleting.id)
      showToast(t('tachograph.supplierDeleted'), 'success')
      setDeleting(null)
      load()
    } catch (e) {
      console.error('Error deleting tachograph supplier:', e)
      showToast(t('tachograph.supplierDeleteFailed'), 'error')
    } finally {
      setDeletingBusy(false)
    }
  }

  const columns = [
    {
      key: 'name',
      label: t('tachograph.name'),
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          {row.contact_name && (
            <p className="text-[12px] text-muted-foreground">{row.contact_name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      label: t('tachograph.phone'),
      render: (row) =>
        row.phone ? (
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <Phone {...SF} className="h-3.5 w-3.5 text-muted-foreground" />
            {row.phone}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'email',
      label: t('tachograph.email'),
      render: (row) =>
        row.email ? (
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <Mail {...SF} className="h-3.5 w-3.5 text-muted-foreground" />
            {row.email}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'prices',
      label: t('tachograph.itemPrices'),
      render: (row) => {
        const byType = tariffsBySupplier.get(String(row.id))
        const count = operationTypes.filter((type) => byType?.has(String(type.id))).length

        const badge = (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold transition-colors ${
              count > 0
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Coins01 {...SF} className="h-3.5 w-3.5" />
            {count > 0
              ? t('tachograph.pricedItemsCount', { count, total: operationTypes.length })
              : t('tachograph.setPrices')}
          </span>
        )

        return canManagePrices ? (
          <button
            type="button"
            onClick={() => openPrices(row)}
            className="text-left hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-full"
            title={t('tachograph.managePrices')}
          >
            {badge}
          </button>
        ) : (
          badge
        )
      },
    },
    {
      key: 'active',
      label: t('common.status'),
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
            row.active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
          }`}
        >
          {row.active ? t('tachograph.active') : t('tachograph.inactive')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {canManagePrices && (
            <button
              type="button"
              onClick={() => openPrices(row)}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t('tachograph.managePrices')}
              title={t('tachograph.managePrices')}
            >
              <Coins01 {...SF} className="h-4 w-4" />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => openEdit(row)}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t('common.edit')}
              title={t('common.edit')}
            >
              <Edit {...SF} className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleting(row)}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label={t('common.delete')}
              title={t('common.delete')}
            >
              <Trash {...SF} className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  if (loading) return <PageSpinner message={t('common.loading')} />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {t('settings.itemCount', { count: suppliers.length })}
        </span>
        {canCreate && (
          <Button size="sm" onClick={openCreate}>
            <Plus {...SF} className="h-4 w-4" />
            {t('tachograph.newSupplier')}
          </Button>
        )}
      </div>

      {error ? (
        <Card>
          <p className="py-6 text-center text-[15px] font-medium text-destructive">
            {t('tachograph.loadFailed')}
          </p>
        </Card>
      ) : suppliers.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building01}
            title={t('tachograph.noSuppliers')}
            description={t('tachograph.noSuppliersDesc')}
            action={
              canCreate ? (
                <Button onClick={openCreate}>
                  <Plus {...SF} className="h-4 w-4" />
                  {t('tachograph.newSupplier')}
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <Table columns={columns} data={suppliers} emptyMessage={t('ui.noData')} />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? t('tachograph.editSupplier') : t('tachograph.newSupplier')}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('tachograph.name')}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label={t('tachograph.contactName')}
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            placeholder={t('settings.optionalPlaceholder')}
          />
          <Input
            label={t('tachograph.phone')}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label={t('tachograph.email')}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Input
              label={t('tachograph.address')}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder={t('settings.optionalPlaceholder')}
            />
          </div>
          <Select
            label={t('common.status')}
            options={[
              { value: 'active', label: t('tachograph.active') },
              { value: 'inactive', label: t('tachograph.inactive') },
            ]}
            value={form.active ? 'active' : 'inactive'}
            onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}
          />
          <div className="sm:col-span-2">
            <Input
              label={t('common.notes')}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t('common.optionalNotes')}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!pricesSupplier}
        onClose={closePrices}
        title={
          pricesSupplier
            ? t('tachograph.supplierPricesTitle', { name: pricesSupplier.name })
            : t('tachograph.itemPrices')
        }
        description={t('tachograph.supplierPricesHint')}
        size="lg"
        scrollable
        footer={
          <>
            <Button variant="outline" onClick={closePrices} disabled={savingPrices}>
              {t('common.cancel')}
            </Button>
            {operationTypes.length > 0 && (
              <Button onClick={handleSavePrices} loading={savingPrices}>
                {t('common.save')}
              </Button>
            )}
          </>
        }
      >
        {operationTypes.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {t('tachograph.noOperationTypesForPrices')}
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_11rem_minmax(0,1fr)_2.25rem] items-center gap-3 bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
              <span>{t('settings.tachoItemLabel')}</span>
              <span>{t('tachograph.pricePerUnitMAD')}</span>
              <span>{t('common.notes')}</span>
              <span />
            </div>
            {operationTypes.map((type) => {
              const draft = priceDrafts[type.id] || { price: '', notes: '' }
              const hasValue = draft.price !== '' || draft.notes !== ''
              return (
                <div
                  key={type.id}
                  className="grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_11rem_minmax(0,1fr)_2.25rem]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {operationTypeLabel(type, i18n.language)}
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.price}
                      onChange={(e) => updatePriceDraft(type.id, { price: e.target.value })}
                      placeholder="—"
                      aria-label={`${operationTypeLabel(type, i18n.language)} — ${t('tachograph.pricePerUnitMAD')}`}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 pr-12 text-right text-sm tabular-nums text-foreground shadow-sm transition-all placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                      MAD
                    </span>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={draft.notes}
                      onChange={(e) => updatePriceDraft(type.id, { notes: e.target.value })}
                      placeholder={t('settings.optionalPlaceholder')}
                      aria-label={`${operationTypeLabel(type, i18n.language)} — ${t('common.notes')}`}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-all placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!hasValue}
                      onClick={() => updatePriceDraft(type.id, { price: '', notes: '' })}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={t('tachograph.clearPrice')}
                      title={t('tachograph.clearPrice')}
                    >
                      <XClose {...SF} className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={t('tachograph.deleteSupplier')}
        message={t('tachograph.deleteSupplierConfirm', { name: deleting?.name || '' })}
        loading={deletingBusy}
      />
    </div>
  )
}
