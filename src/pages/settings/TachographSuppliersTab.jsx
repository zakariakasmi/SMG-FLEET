import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Edit01 as Edit,
  Trash01 as Trash,
  Building01,
  Phone,
  Mail01 as Mail,
} from '@untitledui/icons'
import { tachographApi } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
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

// Settings tab for the garages/tachograph centres the fleet works with. The
// list used to live in the Chronotachygraphe module; it belongs with the other
// reference data, so the page title and description come from the Settings
// tab header and only the toolbar is rendered here.
export default function TachographSuppliersTab() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { can } = useAuth()

  const canCreate = can('addTachograph')
  const canEdit = can('editTachograph')
  const canDelete = can('deleteTachograph')

  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const supplierRows = await tachographApi.listSuppliers()
      setSuppliers(supplierRows || [])
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
          {canEdit && (
            <button
              type="button"
              onClick={() => openEdit(row)}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t('common.edit')}
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
