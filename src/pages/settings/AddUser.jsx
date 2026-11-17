import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Save01 as Save, Shield01 as Shield, User01 as UserIcon } from '@untitledui/icons'
import { useTranslation } from 'react-i18next'
import { usersApi } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useUnsaved } from '../../components/ui/UnsavedChangesGuard'
import { ALL_PERMISSION_KEYS, PERMISSION_LABELS } from '../../constants/permissions'
import PermissionPicker from '../../components/settings/PermissionPicker'
import { isValidEmail } from '../../lib/utils'

const STEPS = [
  { id: 1, titleKey: 'settings.stepIdentity', descKey: 'settings.stepIdentityDesc' },
  { id: 2, titleKey: 'settings.stepAccess', descKey: 'settings.stepAccessDesc' },
  { id: 3, titleKey: 'settings.stepReview', descKey: 'settings.stepReviewDesc' },
]

const INITIAL_FORM = {
  email: '',
  password: '',
  display_name: '',
  role: 'user',
  // Everything is ticked by default except the fleet-manager demand scope: a
  // new user sees their own demands until it is granted explicitly.
  permissions: ALL_PERMISSION_KEYS.filter((key) => key !== 'viewAllTachographDemands'),
}

export default function AddUser() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { setDirty, markSaved, showGuard } = useUnsaved()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ ...INITIAL_FORM, permissions: [...INITIAL_FORM.permissions] })
  const [saving, setSaving] = useState(false)

  const isDirty = JSON.stringify(form) !== JSON.stringify(INITIAL_FORM)

  useEffect(() => { setDirty(isDirty) }, [isDirty, setDirty])

  const isAdminForm = form.role === 'admin'

  const togglePermission = (key) => {
    const CHARGE_SUB_KEYS = ['addCharges', 'editCharges', 'deleteCharges']
    setForm((prev) => {
      const has = prev.permissions.includes(key)
      let next
      if (has) {
        next = prev.permissions.filter((k) => k !== key && (key !== 'charges' || !CHARGE_SUB_KEYS.includes(k)))
      } else {
        next = [...prev.permissions, key]
        if (CHARGE_SUB_KEYS.includes(key) && !next.includes('charges')) {
          next.push('charges')
        }
      }
      return { ...prev, permissions: next }
    })
  }

  const goNext = () => {
    if (step === 1) {
      if (!form.email.trim()) {
        showToast(t('settings.emailRequired'), 'error')
        return
      }
      if (!isValidEmail(form.email)) {
        showToast(t('settings.emailInvalid'), 'error')
        return
      }
      if (!form.password.trim()) {
        showToast(t('settings.passwordRequired'), 'error')
        return
      }
    }
    setStep(Math.min(step + 1, STEPS.length))
  }

  const handleSave = async () => {
    const permissions = isAdminForm ? ALL_PERMISSION_KEYS : form.permissions
    try {
      setSaving(true)
      await usersApi.create({
        email: form.email.trim(),
        password: form.password,
        display_name: form.display_name.trim(),
        role: form.role,
        permissions,
      })
      markSaved()
      showToast(t('settings.saved'), 'success')
      navigate('/settings/users')
    } catch (e) {
      showToast(e.message || t('settings.failedToSave'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => showGuard(() => navigate('/settings/users'))}>
          <ArrowLeft className="w-5 h-5 mr-1" />
          {t('common.back')}
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('settings.addUser')}</h1>
        <p className="text-base mt-1.5 text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <div className="w-full rounded-2xl p-8 lg:p-10 bg-card border border-border shadow-sm">
        {/* Progress steps */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-10">
          {STEPS.map((s, i) => {
            const active = step === s.id
            const done = step > s.id
            return (
              <div key={s.id} className="flex items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-sm font-semibold transition-all ${active || done ? 'bg-primary' : 'bg-muted-foreground/30 opacity-50'}`}
                  >
                    {done ? <Check className="w-5 h-5" /> : s.id}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-[15px] font-semibold leading-tight transition-colors ${active || done ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      {t(s.titleKey)}
                    </p>
                    <p className="text-xs leading-tight mt-0.5 text-muted-foreground">
                      {t(s.descKey)}
                    </p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block h-px w-16 bg-border" />
                )}
              </div>
            )
          })}
        </div>

        {/* Step 1 — Identity */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label={t('settings.email')}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@company.com"
              required
              autoComplete="off"
            />
            <Input
              label={t('settings.password')}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <Input
              className="md:col-span-2"
              label={t('settings.displayName')}
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder={t('settings.optionalPlaceholder')}
            />
          </div>
        )}

        {/* Step 2 — Access */}
        {step === 2 && (
          <div className="space-y-8">
            <div>
              <p className="block text-base font-medium mb-3 text-muted-foreground">
                {t('settings.role')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'user' })}
                  className={`rounded-xl border-[1.5px] p-5 text-left transition-all ${form.role === 'user' ? 'bg-primary/10 border-primary' : 'bg-transparent border-border'}`}
                >
                  <UserIcon className="w-6 h-6 mb-3 text-primary" />
                  <p className="text-base font-semibold text-foreground">
                    {t('settings.roleUser')}
                  </p>
                  <p className="text-sm mt-1 text-muted-foreground">
                    {t('settings.roleUserDesc')}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'admin' })}
                  className={`rounded-xl border-[1.5px] p-5 text-left transition-all ${form.role === 'admin' ? 'bg-primary/10 border-primary' : 'bg-transparent border-border'}`}
                >
                  <Shield className="w-6 h-6 mb-3 text-primary" />
                  <p className="text-base font-semibold text-foreground">
                    {t('settings.roleAdmin')}
                  </p>
                  <p className="text-sm mt-1 text-muted-foreground">
                    {t('settings.roleAdminDesc')}
                  </p>
                </button>
              </div>
            </div>

            {isAdminForm ? (
              <p className="text-base rounded-lg px-5 py-4 text-muted-foreground bg-primary/10 border border-primary/20">
                {t('settings.adminFullAccess')}
              </p>
            ) : (
              <PermissionPicker
                value={form.permissions}
                onToggle={togglePermission}
                className="grid-cols-1 lg:grid-cols-3"
              />
            )}
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: t('settings.email'), value: form.email.trim() },
              { label: t('settings.displayName'), value: form.display_name.trim() || '—' },
              { label: t('settings.role'), value: t(isAdminForm ? 'settings.roleAdmin' : 'settings.roleUser') },
              {
                label: t('settings.permissions'),
                value: isAdminForm
                  ? t('settings.adminFullAccess')
                  : [...form.permissions]
                      .filter((k) => PERMISSION_LABELS[k])
                      .map((k) => t(PERMISSION_LABELS[k]))
                      .join(', '),
              },
            ].map((row) => (
              <div key={row.label} className="rounded-lg px-5 py-4 border border-border">
                <p className="text-xs font-medium uppercase tracking-wide mb-1 text-muted-foreground">
                  {row.label}
                </p>
                <p className="text-base break-words text-foreground">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-3 pt-8 mt-10 border-t border-border">
          {step > 1 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              {t('common.back')}
            </Button>
          )}
          <div className="flex-1" />
          {step < STEPS.length ? (
            <Button size="lg" onClick={goNext}>
              {t('common.next')}
            </Button>
          ) : (
            <>
              <Button variant="danger" size="lg" onClick={() => showGuard(() => navigate('/settings/users'))}>
                {t('common.cancel')}
              </Button>
              <Button size="lg" onClick={handleSave} loading={saving}>
                <Save className="w-5 h-5 mr-2" />
                {t('common.create')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}