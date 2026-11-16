import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users01 as UsersIcon, User01 as User, Shield01 as Shield, Tag01 as Tag, Truck01 as Truck, Speedometer01 as Fuel, Receipt, Tool01 as Tool, Building01, Edit01 as Edit, Trash01 as Trash2, Loading02 as Loader2, ChevronDown } from '@untitledui/icons'
import { useTranslation } from 'react-i18next'
import { cn } from 'cn'
import {
  usersApi,
  categoriesApi,
  vehicleTypesApi,
  fuelTypesApi,
  chargeTypesApi,
  referenceCountsApi,
  tachographApi,
} from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useUnsaved } from '../../components/ui/UnsavedChangesGuard'
import { ALL_PERMISSION_KEYS } from '../../constants/permissions'
import { isValidEmail } from '../../lib/utils'
import { PageSpinner } from '../../components/ui/Spinner'
import TachographSuppliersTab from './TachographSuppliersTab'

import { Button } from '../../components/ui-shadcn/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui-shadcn/card'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui-shadcn/table'
import { Badge } from '../../components/ui-shadcn/badge'
import { Avatar, AvatarFallback } from '../../components/ui-shadcn/avatar'
import { Input } from '../../components/ui-shadcn/input'
import { Label } from '../../components/ui-shadcn/label'
import { RadioGroup, RadioGroupItem } from '../../components/ui-shadcn/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui-shadcn/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui-shadcn/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '../../components/ui-shadcn/alert-dialog'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../components/ui-shadcn/collapsible'
import { Separator } from '../../components/ui-shadcn/separator'
import Modal from '../../components/ui/Modal'
import PermissionPicker from '../../components/settings/PermissionPicker'

function useFormDirty(active, value, baseline) {
  const { setDirty } = useUnsaved()
  useEffect(() => {
    setDirty(!!active && JSON.stringify(value) !== JSON.stringify(baseline))
    return () => setDirty(false)
  }, [active, value, baseline, setDirty])
}

function RowActions({ onEdit, onDelete, t }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onEdit}
        aria-label={t('common.edit')}
        title={t('common.edit')}
        className="text-muted-foreground hover:text-foreground"
      >
        <Edit />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onDelete}
        aria-label={t('common.delete')}
        title={t('common.delete')}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </div>
  )
}

function DeleteDialog({ open, onOpenChange, title, message, onConfirm, t }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>{t('common.delete')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ItemsEmpty({ t, label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function ReferenceItemsTable({ t, items, countOf, onEdit, onDelete, icon: Icon }) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('settings.name')}</TableHead>
            <TableHead className="text-right">{t('dashboard.vehicles')}</TableHead>
            <TableHead className="text-right">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2">
                    {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm font-medium tabular-nums text-foreground">{countOf(item)}</span>
                </TableCell>
                <TableCell className="text-right">
                  <RowActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} t={t} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}

function RoleRadio({ value, title, desc, icon: Icon, disabled }) {
  const id = `role-${value}`
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border border-border p-3', disabled && 'opacity-60')}>
      <RadioGroupItem value={value} id={id} disabled={disabled} />
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="flex items-center gap-1.5">
          <Icon className="size-3.5 text-muted-foreground" />
          {title}
        </Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

function UsersTab({ t }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [form, setForm] = useState({ email: '', password: '', display_name: '', role: 'user', permissions: [] })
  const [baseline, setBaseline] = useState(null)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { markSaved } = useUnsaved()
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()

  const adminCount = users.filter((u) => u.role === 'admin').length

  useFormDirty(dialogOpen, form, baseline)

  const load = async () => {
    try {
      setLoading(true)
      setUsers(await usersApi.list())
    } catch (e) { showToast(t('settings.failedToLoad'), 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const allPermissions = ALL_PERMISSION_KEYS
  const isAdminForm = form.role === 'admin'

  const openAdd = () => navigate('/settings/users/new')
  const openEdit = (u) => {
    setCurrent(u)
    const next = {
      email: u.email,
      password: '',
      display_name: u.display_name || '',
      role: u.role,
      permissions: u.role === 'admin' ? [...allPermissions] : (Array.isArray(u.permissions) ? [...u.permissions] : []),
    }
    setForm(next)
    setBaseline(next)
    setDialogOpen(true)
  }

  const togglePermission = (key) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((k) => k !== key)
        : [...prev.permissions, key],
    }))
  }

  const handleSave = async () => {
    if (!form.email.trim()) { showToast(t('settings.emailRequired'), 'error'); return }
    if (!isValidEmail(form.email)) { showToast(t('settings.emailInvalid'), 'error'); return }
    if (!current && !form.password.trim()) { showToast(t('settings.passwordRequired'), 'error'); return }
    const isSelf = current && Number(current.id) === Number(currentUser?.id)
    if (current && form.role !== current.role && isSelf) {
      showToast(t('settings.cannotChangeOwnRole'), 'error')
      return
    }
    if (current && form.role !== current.role && current.role === 'admin' && adminCount <= 1) {
      showToast(t('settings.lastAdminWarning'), 'error')
      return
    }
    const permissions = isAdminForm ? allPermissions : form.permissions
    try {
      setSaving(true)
      if (current) {
        const updates = { display_name: form.display_name.trim(), role: form.role, permissions }
        if (form.password.trim()) updates.password = form.password
        await usersApi.update(current.id, updates)
      } else {
        await usersApi.create({ email: form.email.trim(), password: form.password, display_name: form.display_name.trim(), role: form.role, permissions })
      }
      markSaved()
      showToast(t('settings.saved'), 'success')
      setDialogOpen(false)
      load()
    } catch (e) { showToast(e.message || t('settings.failedToSave'), 'error') }
    finally { setSaving(false) }
  }

  const requestDelete = (u) => {
    if (Number(u.id) === Number(currentUser?.id)) {
      showToast(t('settings.cannotDeleteSelf'), 'error')
      return
    }
    if (u.role === 'admin' && adminCount <= 1) {
      showToast(t('settings.lastAdminWarning'), 'error')
      return
    }
    setCurrent(u)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    try {
      await usersApi.delete(current.id)
      showToast(t('settings.deleted'), 'success')
      setDeleteOpen(false)
      load()
    } catch (e) { showToast(t('settings.failedToDelete'), 'error') }
  }

  if (loading) return <PageSpinner />

  const isSelf = current && Number(current.id) === Number(currentUser?.id)

  const initials = (u) => {
    const name = (u.display_name || '').trim()
    if (name) return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    return ((u.email || u.username || '?')[0] || '?').toUpperCase()
  }

  const roleLabel = (role) => t(role === 'admin' ? 'settings.roleAdmin' : 'settings.roleUser')
  const caption = (u) =>
    u.role === 'admin'
      ? t('settings.fullAccess')
      : t('settings.permCount', { count: Array.isArray(u.permissions) ? u.permissions.length : 0 })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('settings.userCount', { count: users.length })}
        </span>
        <Button size="sm" onClick={openAdd}>
          <Plus data-icon="inline-start" />
          {t('settings.addUser')}
        </Button>
      </div>

      {users.length === 0 ? (
        <ItemsEmpty t={t} label={t('settings.noUsers')} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-72">{t('settings.email')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('settings.access')}</TableHead>
                <TableHead>{t('settings.role')}</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const self = Number(u.id) === Number(currentUser?.id)
                const admin = u.role === 'admin'
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className={admin ? 'bg-primary/10 text-primary' : undefined}>
                            {initials(u)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium">
                            {(u.display_name || '').trim() || u.email || u.username || '—'}
                          </span>
                          {self && <Badge variant="outline">{t('settings.you')}</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{caption(u)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={admin ? 'default' : 'secondary'}>{roleLabel(u.role)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <RowActions
                          onEdit={() => openEdit(u)}
                          onDelete={() => requestDelete(u)}
                          t={t}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Modal
        isOpen={dialogOpen}
        onClose={() => { if (!saving) setDialogOpen(false) }}
        title={current ? t('settings.editUser') : t('settings.addUser')}
        description={current ? current.email : t('settings.stepIdentityDesc')}
        size="xl"
        scrollable
        bodyCls="px-6 pb-6 pt-2"
        footerCls="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-6 py-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {current ? t('common.update') : t('common.create')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="user-display-name">{t('settings.displayName')}</Label>
              <Input
                id="user-display-name"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">{t('settings.email')}</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={!!current}
                placeholder={current ? '' : 'user@company.com'}
                required
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="user-password">{current ? t('settings.newPassword') : t('settings.password')}</Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={current ? t('settings.leaveEmptyToKeep') : ''}
              />
            </div>
          </div>

          <Separator />

          <div className="grid gap-2">
            <Label>{t('settings.role')}</Label>
            <RadioGroup
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v })}
              className="grid gap-2 sm:grid-cols-2"
            >
              <RoleRadio value="user" title={t('settings.roleUser')} desc={t('settings.roleUserDesc')} icon={User} disabled={isSelf} />
              <RoleRadio value="admin" title={t('settings.roleAdmin')} desc={t('settings.roleAdminDesc')} icon={Shield} disabled={isSelf} />
            </RadioGroup>
          </div>

          <Separator />

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label>{t('settings.permissions')}</Label>
              {!isAdminForm && (
                <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                  {form.permissions.filter((key) => ALL_PERMISSION_KEYS.includes(key)).length}
                  {' / '}
                  {ALL_PERMISSION_KEYS.length}
                </span>
              )}
            </div>
            {isAdminForm ? (
              <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                {t('settings.adminFullAccess')}
              </p>
            ) : (
              <PermissionPicker value={form.permissions} onToggle={togglePermission} />
            )}
          </div>
        </div>
      </Modal>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => { if (!o) setDeleteOpen(false) }}
        title={t('settings.deleteUser')}
        message={t('settings.deleteUserConfirm', { name: current?.username })}
        onConfirm={handleDelete}
        t={t}
      />
    </div>
  )
}

function CategoriesTab({ t }) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [baseline, setBaseline] = useState(null)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { markSaved } = useUnsaved()

  useFormDirty(modal, form, baseline)

  const load = async () => {
    try {
      setLoading(true)
      const [list, counts] = await Promise.all([categoriesApi.list(), referenceCountsApi.categories()])
      setCategories(list.map((c) => ({ ...c, vehicleCount: counts[c.id] || 0 })))
    } catch (e) { showToast(t('settings.failedToLoad'), 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { const next = { name: '', description: '' }; setCurrent(null); setForm(next); setBaseline(next); setModal(true) }
  const openEdit = (c) => { const next = { name: c.name, description: c.description || '' }; setCurrent(c); setForm(next); setBaseline(next); setModal(true) }

  const handleSave = async () => {
    if (!form.name.trim()) { showToast(t('settings.nameRequired'), 'error'); return }
    try {
      setSaving(true)
      if (current) {
        await categoriesApi.update(current.id, { name: form.name.trim(), description: form.description.trim() || null })
      } else {
        await categoriesApi.create({ name: form.name.trim(), description: form.description.trim() || null })
      }
      markSaved()
      showToast(t('settings.saved'), 'success')
      setModal(false)
      load()
    } catch (e) { showToast(e.message || t('settings.failedToSave'), 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try {
      await categoriesApi.delete(current.id)
      showToast(t('settings.deleted'), 'success')
      setDeleteOpen(false)
      load()
    } catch (e) { showToast(t('settings.failedToDelete'), 'error') }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('settings.itemCount', { count: categories.length })}
        </span>
        <Button size="sm" onClick={openAdd}>
          <Plus data-icon="inline-start" />
          {t('common.create')}
        </Button>
      </div>

      {categories.length === 0 ? (
        <ItemsEmpty t={t} label={t('settings.noItems')} />
      ) : (
        <ReferenceItemsTable
          t={t}
          items={categories}
          icon={Tag}
          countOf={(c) => c.vehicleCount}
          onEdit={openEdit}
          onDelete={(c) => { setCurrent(c); setDeleteOpen(true) }}
        />
      )}

      <Dialog
        open={modal}
        onOpenChange={(o) => { if (!o && !saving) setModal(false) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{current ? t('settings.editCategory') : t('settings.addCategory')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">{t('settings.name')}</Label>
              <Input id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cat-desc">{t('settings.description')}</Label>
              <Input
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('settings.optionalPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {current ? t('common.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => { if (!o) setDeleteOpen(false) }}
        title={t('settings.deleteCategory')}
        message={t('settings.deleteConfirm', { name: current?.name })}
        onConfirm={handleDelete}
        t={t}
      />
    </div>
  )
}

function NameListTab({ items, onSaveItem, onDeleteItem, onAdd, countOf, t, icon: Icon }) {
  const [modal, setModal] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { markSaved } = useUnsaved()

  useFormDirty(modal, name.trim(), current?.name || '')

  const openAdd = () => { setCurrent(null); setName(''); setModal(true) }
  const openEdit = (item) => { setCurrent(item); setName(item.name); setModal(true) }

  const handleSave = async () => {
    if (!name.trim()) { showToast(t('settings.nameRequired'), 'error'); return }
    try {
      setSaving(true)
      await onSaveItem(current, name.trim())
      markSaved()
      showToast(t('settings.saved'), 'success')
      setModal(false)
      onAdd?.()
    } catch (e) { showToast(e.message || t('settings.failedToSave'), 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try {
      await onDeleteItem(current.id)
      showToast(t('settings.deleted'), 'success')
      setDeleteOpen(false)
      onAdd?.()
    } catch (e) { showToast(t('settings.failedToDelete'), 'error') }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('settings.itemCount', { count: items.length })}
        </span>
        <Button size="sm" onClick={openAdd}>
          <Plus data-icon="inline-start" />
          {t('common.create')}
        </Button>
      </div>

      {items.length === 0 ? (
        <ItemsEmpty t={t} label={t('settings.noItems')} />
      ) : (
        <ReferenceItemsTable
          t={t}
          items={items}
          icon={Icon}
          countOf={countOf}
          onEdit={openEdit}
          onDelete={(item) => { setCurrent(item); setDeleteOpen(true) }}
        />
      )}

      <Dialog
        open={modal}
        onOpenChange={(o) => { if (!o && !saving) setModal(false) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{current ? t('settings.editItem') : t('settings.addItem')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="item-name">{t('settings.name')}</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {current ? t('common.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => { if (!o) setDeleteOpen(false) }}
        title={t('settings.deleteItem')}
        message={t('settings.deleteConfirm', { name: current?.name })}
        onConfirm={handleDelete}
        t={t}
      />
    </div>
  )
}

function VehicleTypesTab({ t }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  const load = async () => {
    try {
      setLoading(true)
      const [list, counts] = await Promise.all([vehicleTypesApi.list(), referenceCountsApi.vehicleTypes()])
      setItems(list.map((item) => ({ ...item, vehicleCount: counts[item.id] || 0 })))
    } catch (e) { showToast(t('settings.failedToLoad'), 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <PageSpinner />

  return (
    <NameListTab
      items={items}
      icon={Truck}
      countOf={(item) => item.vehicleCount}
      t={t}
      onAdd={load}
      onSaveItem={(cur, name) => cur ? vehicleTypesApi.update(cur.id, { name }) : vehicleTypesApi.create({ name })}
      onDeleteItem={(id) => vehicleTypesApi.delete(id)}
    />
  )
}

function FuelTypesTab({ t }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  const load = async () => {
    try {
      setLoading(true)
      const [list, counts] = await Promise.all([fuelTypesApi.list(), referenceCountsApi.fuelTypes()])
      setItems(list.map((item) => ({ ...item, vehicleCount: counts[item.id] || 0 })))
    } catch (e) { showToast(t('settings.failedToLoad'), 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <PageSpinner />

  return (
    <NameListTab
      items={items}
      icon={Fuel}
      countOf={(item) => item.vehicleCount}
      t={t}
      onAdd={load}
      onSaveItem={(cur, name) => cur ? fuelTypesApi.update(cur.id, { name }) : fuelTypesApi.create({ name })}
      onDeleteItem={(id) => fuelTypesApi.delete(id)}
    />
  )
}

function ChargeTypesTab({ t }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [form, setForm] = useState({ name: '', display_name: '', frequency: 'annual', due_date_type: 'fixed' })
  const [baseline, setBaseline] = useState(null)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { markSaved } = useUnsaved()

  useFormDirty(modal, form, baseline)

  const load = async () => {
    try {
      setLoading(true)
      const [list, counts] = await Promise.all([chargeTypesApi.list(), referenceCountsApi.chargeTypes()])
      setItems(list.map((item) => ({ ...item, vehicleCount: counts[item.id] || 0 })))
    } catch (e) { showToast(t('settings.failedToLoad'), 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { const next = { name: '', display_name: '', frequency: 'annual', due_date_type: 'fixed' }; setCurrent(null); setForm(next); setBaseline(next); setModal(true) }
  const openEdit = (c) => { const next = { name: c.name, display_name: c.display_name, frequency: c.frequency || '', due_date_type: c.due_date_type || '' }; setCurrent(c); setForm(next); setBaseline(next); setModal(true) }

  const handleSave = async () => {
    if (!form.name.trim() || !form.display_name.trim()) { showToast(t('settings.nameRequired'), 'error'); return }
    try {
      setSaving(true)
      if (current) {
        await chargeTypesApi.update(current.id, form)
      } else {
        await chargeTypesApi.create(form)
      }
      markSaved()
      showToast(t('settings.saved'), 'success')
      setModal(false)
      load()
    } catch (e) { showToast(e.message || t('settings.failedToSave'), 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try {
      await chargeTypesApi.delete(current.id)
      showToast(t('settings.deleted'), 'success')
      setDeleteOpen(false)
      load()
    } catch (e) { showToast(t('settings.failedToDelete'), 'error') }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('settings.itemCount', { count: items.length })}
        </span>
        <Button size="sm" onClick={openAdd}>
          <Plus data-icon="inline-start" />
          {t('common.create')}
        </Button>
      </div>

      {items.length === 0 ? (
        <ItemsEmpty t={t} label={t('settings.noItems')} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.name')}</TableHead>
                <TableHead className="text-right">{t('dashboard.vehicles')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <Receipt className="size-4 shrink-0 text-muted-foreground" />
                      <span className="block truncate text-sm font-medium text-foreground">{c.display_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-medium tabular-nums text-foreground">{c.vehicleCount}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => openEdit(c)}
                      onDelete={() => { setCurrent(c); setDeleteOpen(true) }}
                      t={t}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog
        open={modal}
        onOpenChange={(o) => { if (!o && !saving) setModal(false) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{current ? t('settings.editChargeType') : t('settings.addChargeType')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ct-name">{t('settings.internalName')}</Label>
              <Input
                id="ct-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="visite_technique"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ct-display">{t('settings.chargeDisplayName')}</Label>
              <Input
                id="ct-display"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Visite technique"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t('settings.frequency')}</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger aria-label={t('settings.frequency')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">{t('settings.annual')}</SelectItem>
                    <SelectItem value="12_months">{t('settings.12Months')}</SelectItem>
                    <SelectItem value="24_months">{t('settings.24Months')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t('settings.dueDateType')}</Label>
                <Select value={form.due_date_type} onValueChange={(v) => setForm({ ...form, due_date_type: v })}>
                  <SelectTrigger aria-label={t('settings.dueDateType')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{t('settings.fixed')}</SelectItem>
                    <SelectItem value="variable">{t('settings.variable')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {current ? t('common.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => { if (!o) setDeleteOpen(false) }}
        title={t('settings.deleteChargeType')}
        message={t('settings.deleteConfirm', { name: current?.display_name })}
        onConfirm={handleDelete}
        t={t}
      />
    </div>
  )
}

const EMPTY_TACHO_ITEM = { name: '' }

// "Révision périodique" -> "revision_periodique" (DB key the app never shows).
function slugifyItemCode(name) {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return base || 'operation'
}

// Reference list for the Chronotachygraphe module: what can be recorded on a
// vehicle (repair, periodic revision, paper revision, calibration, …).
// Deliberately minimal — one name. The code, the EN name and the display order
// are derived automatically, and interval/certificate keep their DB defaults
// (existing rows keep the values they already have).
function TachographItemsTab({ t }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { markSaved } = useUnsaved()

  useFormDirty(modal, name.trim(), current ? current.name_fr || current.name_en || '' : '')

  const load = async () => {
    try {
      setLoading(true)
      const [list, counts] = await Promise.all([
        tachographApi.listOperationTypes(),
        referenceCountsApi.tachographOperationTypes(),
      ])
      setItems(list.map((item) => ({ ...item, operationCount: counts[item.id] || 0 })))
    } catch (e) {
      showToast(t('settings.failedToLoad'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setCurrent(null)
    setName('')
    setModal(true)
  }

  const openEdit = (item) => {
    setCurrent(item)
    setName(item.name_fr || item.name_en || '')
    setModal(true)
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      showToast(t('settings.tachoItemNameRequired'), 'error')
      return
    }

    try {
      setSaving(true)
      if (current) {
        // Only the name changes; keep the code and any interval/certificate data.
        await tachographApi.updateOperationType(current.id, {
          code: current.code,
          name_fr: trimmed,
          name_en: trimmed,
          default_interval_months: current.default_interval_months,
          requires_certificate: current.requires_certificate,
          sort_order: current.sort_order,
        })
      } else {
        const taken = new Set(items.map((item) => item.code))
        const base = slugifyItemCode(trimmed)
        let code = base
        let suffix = 2
        while (taken.has(code)) code = `${base}_${suffix++}`
        await tachographApi.createOperationType({
          code,
          name_fr: trimmed,
          name_en: trimmed,
          default_interval_months: null,
          requires_certificate: false,
          sort_order: items.reduce((max, item) => Math.max(max, Number(item.sort_order) || 0), 0) + 10,
        })
      }
      markSaved()
      showToast(t('settings.saved'), 'success')
      setModal(false)
      setName('')
      load()
    } catch (e) {
      showToast(e.message || t('settings.failedToSave'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await tachographApi.deleteOperationType(current.id)
      showToast(t('settings.deleted'), 'success')
      setDeleteOpen(false)
      load()
    } catch (e) {
      if (e?.code === '23503') showToast(t('settings.tachoItemInUse'), 'error')
      else showToast(t('settings.failedToDelete'), 'error')
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('settings.itemCount', { count: items.length })}
        </span>
        <Button size="sm" onClick={openAdd}>
          <Plus data-icon="inline-start" />
          {t('common.create')}
        </Button>
      </div>

      {items.length === 0 ? (
        <ItemsEmpty t={t} label={t('settings.noItems')} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.tachoItemLabel')}</TableHead>
                <TableHead className="text-right">{t('settings.tachoItemUsage')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <Tool className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.name_fr || item.name_en}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-medium tabular-nums text-foreground">
                      {item.operationCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => openEdit(item)}
                      onDelete={() => { setCurrent(item); setDeleteOpen(true) }}
                      t={t}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={modal} onOpenChange={(o) => { if (!o && !saving) setModal(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {current ? t('settings.editTachographItem') : t('settings.addTachographItem')}
            </DialogTitle>
            <DialogDescription>{t('settings.descTachographItems')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="tacho-item-name">{t('settings.tachoItemLabel')}</Label>
            <Input
              id="tacho-item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.tachoItemNamePlaceholder')}
              autoFocus
              required
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !saving) {
                  e.preventDefault()
                  handleSave()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {current ? t('common.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => { if (!o) setDeleteOpen(false) }}
        title={t('settings.deleteTachographItem')}
        message={t('settings.deleteConfirm', { name: current?.name_fr || current?.name_en })}
        onConfirm={handleDelete}
        t={t}
      />
    </div>
  )
}

function TachographSettingsTab({ t }) {
  const { showGuard } = useUnsaved()
  const [subTab, setSubTab] = useState('items')

  const subTabs = [
    { id: 'items', label: t('settings.tachographItems'), icon: Tool },
    { id: 'suppliers', label: t('settings.tachographSuppliersAndPrices'), icon: Building01 },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={t('settings.tachograph')}
        className="inline-flex w-full max-w-md rounded-lg border border-border bg-muted/40 p-1 sm:w-auto sm:self-start"
      >
        {subTabs.map((tab) => {
          const Icon = tab.icon
          const active = subTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (subTab !== tab.id) showGuard(() => setSubTab(tab.id))
              }}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {subTab === 'items' && <TachographItemsTab t={t} />}
      {subTab === 'suppliers' && <TachographSuppliersTab />}
    </div>
  )
}

function AccountTab({ t }) {
  const { user: currentUser, login: refreshSession } = useAuth()
  const { showToast } = useToast()
  const [displayName, setDisplayName] = useState(currentUser?.display_name || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const dirtyValue = { displayName, currentPassword, newPassword, confirmPassword }
  const savedBaseline = { displayName: currentUser?.display_name || '', currentPassword: '', newPassword: '', confirmPassword: '' }
  useFormDirty(true, dirtyValue, savedBaseline)

  const roleAdmin = currentUser?.role === 'admin'
  const initials = ((currentUser?.display_name || '').trim() || currentUser?.email || '?')
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  useEffect(() => {
    setDisplayName(currentUser?.display_name || '')
  }, [currentUser])

  const handleSaveProfile = async () => {
    if (!displayName.trim()) { showToast(t('settings.nameRequired'), 'error'); return }
    try {
      setSavingProfile(true)
      const updated = await usersApi.updateProfile(currentUser.id, { display_name: displayName.trim() })
      refreshSession({ ...currentUser, display_name: updated.display_name })
      showToast(t('settings.profileUpdated'), 'success')
    } catch (e) { showToast(t('settings.failedToSave'), 'error') }
    finally { setSavingProfile(false) }
  }

  const handleChangePassword = async () => {
    if (!currentPassword) { showToast(t('settings.currentPasswordRequired'), 'error'); return }
    if (!newPassword || newPassword.length < 4) { showToast(t('settings.passwordTooShort'), 'error'); return }
    if (newPassword !== confirmPassword) { showToast(t('settings.passwordMismatch'), 'error'); return }
    try {
      setSavingPassword(true)
      const updated = await usersApi.changePassword(currentUser.email, currentPassword, newPassword)
      refreshSession({ ...currentUser, display_name: updated.display_name })
      showToast(t('settings.passwordChanged'), 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      showToast(e?.message === 'INVALID_CURRENT_PASSWORD' ? t('settings.incorrectPassword') : t('settings.failedToSave'), 'error')
    }
    finally { setSavingPassword(false) }
  }

  const name = (currentUser?.display_name || '').trim() || currentUser?.email || '—'

  return (
    <div className="grid max-w-2xl gap-4">
      <Card>
        <CardContent className="flex items-center gap-3 pt-4">
          <Avatar size="lg">
            <AvatarFallback className={roleAdmin ? 'bg-primary/10 text-primary' : undefined}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-foreground">{name}</p>
            <p className="truncate text-sm text-muted-foreground">{currentUser?.email}</p>
          </div>
          <div className="ml-auto shrink-0">
            <Badge variant={roleAdmin ? 'default' : 'secondary'}>
              {roleAdmin ? t('settings.roleAdmin') : t('settings.roleUser')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.profileTitle')}</CardTitle>
          <CardDescription>{t('settings.profileDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="acct-email">{t('settings.email')}</Label>
            <Input id="acct-email" value={currentUser?.email || ''} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="acct-name">{t('settings.displayName')}</Label>
            <Input
              id="acct-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('settings.optionalPlaceholder')}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile && <Loader2 className="animate-spin" data-icon="inline-start" />}
            {t('common.save')}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <Collapsible open={showPassword} onOpenChange={setShowPassword}>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-center justify-between gap-3 rounded-t-xl p-4 text-left">
              <div className="grid gap-1">
                <span className="text-base font-medium text-foreground">{t('settings.passwordTitle')}</span>
                <span className="text-sm text-muted-foreground">{t('settings.passwordDesc')}</span>
              </div>
              <ChevronDown
                className={cn('size-4 shrink-0 text-muted-foreground transition-transform', showPassword && 'rotate-180')}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Separator className="mx-4 w-[calc(100%-2rem)]" />
            <div className="grid gap-3 p-4">
              <div className="grid gap-2">
                <Label htmlFor="acct-curr-pw">{t('settings.currentPassword')}</Label>
                <Input
                  id="acct-curr-pw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="acct-new-pw">{t('settings.newPassword')}</Label>
                  <Input
                    id="acct-new-pw"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="acct-confirm-pw">{t('settings.confirmPassword')}</Label>
                  <Input
                    id="acct-confirm-pw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <Button variant="secondary" onClick={handleChangePassword} disabled={savingPassword}>
                  {savingPassword && <Loader2 className="animate-spin" data-icon="inline-start" />}
                  {t('settings.changePassword')}
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}

export default function Settings({ initialTab }) {
  const { t } = useTranslation()
  const { isAdmin, can } = useAuth()
  const { showGuard } = useUnsaved()
  const [activeTab, setActiveTab] = useState(initialTab || 'account')

  const canSeeAdminTabs = isAdmin || can('manageTypes')

  const TAB_META = {
    users: { icon: UsersIcon, labelKey: 'settings.users', descKey: 'settings.descUsers' },
    categories: { icon: Tag, labelKey: 'settings.categories', descKey: 'settings.descCategories' },
    vehicleTypes: { icon: Truck, labelKey: 'settings.vehicleTypes', descKey: 'settings.descVehicleTypes' },
    fuelTypes: { icon: Fuel, labelKey: 'settings.fuelTypes', descKey: 'settings.descFuelTypes' },
    chargeTypes: { icon: Receipt, labelKey: 'settings.chargeTypes', descKey: 'settings.descChargeTypes' },
    tachograph: { icon: Tool, labelKey: 'settings.tachograph', descKey: 'settings.descTachograph' },
    account: { icon: User, labelKey: 'settings.myAccount', descKey: 'settings.descAccount' },
  }

  const adminKeys = [
    ...(isAdmin ? ['users'] : []),
    ...(canSeeAdminTabs ? ['categories', 'vehicleTypes', 'fuelTypes', 'chargeTypes'] : []),
    ...(canSeeAdminTabs || can('addTachograph') || can('editTachograph') ? ['tachograph'] : []),
  ]
  const tabKeys = [...adminKeys, 'account']

  const effectiveTab = tabKeys.includes(activeTab) ? activeTab : (tabKeys[0] || 'account')
  const meta = TAB_META[effectiveTab]
  const NavIcon = meta.icon

  const NavItem = ({ tab, label, icon: Icon }) => {
    const active = effectiveTab === tab
    return (
      <button
        type="button"
        onClick={() => showGuard(() => setActiveTab(tab))}
        className={cn(
          'flex w-full items-start justify-start gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug transition-colors',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <Icon className="mt-0.5 size-4 shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[max-content_minmax(0,1fr)]">
        <nav className="flex flex-col gap-1 lg:sticky lg:top-6 lg:min-w-[200px]">
          {adminKeys.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('settings.groupAdmin')}
              </p>
              {adminKeys.map((key) => (
                <NavItem key={key} tab={key} label={t(TAB_META[key].labelKey)} icon={TAB_META[key].icon} />
              ))}
            </>
          )}
          <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('settings.groupAccount')}
          </p>
          <NavItem tab="account" label={t(TAB_META.account.labelKey)} icon={TAB_META.account.icon} />
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-1">
            <div className="flex items-center gap-2">
              <NavIcon className="size-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{t(meta.labelKey)}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t(meta.descKey)}</p>
          </div>

          {effectiveTab === 'users' && <UsersTab t={t} />}
          {effectiveTab === 'categories' && <CategoriesTab t={t} />}
          {effectiveTab === 'vehicleTypes' && <VehicleTypesTab t={t} />}
          {effectiveTab === 'fuelTypes' && <FuelTypesTab t={t} />}
          {effectiveTab === 'chargeTypes' && <ChargeTypesTab t={t} />}
          {effectiveTab === 'tachograph' && <TachographSettingsTab t={t} />}
          {effectiveTab === 'account' && <AccountTab t={t} />}
        </div>
      </div>
    </div>
  )
}