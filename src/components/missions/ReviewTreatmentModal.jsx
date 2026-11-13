import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, Trash01, Plus } from '@untitledui/icons'
import { missionsApi, expenseCategoriesApi, ledgerVehiclesApi, vehiclesApi } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../utils/formatters'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Select from '../ui/Select'
import Input from '../ui/Input'
import AutocompleteInput from '../ui/AutocompleteInput'

const SF = { strokeWidth: 1.75, fill: 'none' }

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-all ${
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Treats one Review-queue item (spec §11). Two kinds:
 *  - expense: pick the real expense category for a needs_review line → writes
 *    mission_expenses + a durable expense_overrides row (re-applied on import).
 *  - vehicle: link an unknown mission_vehicle to a fleet vehicle or ledger plate
 *    (→ import_vehicle_overrides), or dismiss the raw label entirely.
 */
export default function ReviewTreatmentModal({ isOpen, kind, item, onClose, onSaved }) {
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [fleet, setFleet] = useState([])
  const [ledger, setLedger] = useState([])
  const [splitLines, setSplitLines] = useState([])
  const [mode, setMode] = useState('fleet')
  const [fleetLabel, setFleetLabel] = useState('')
  const [ledgerId, setLedgerId] = useState('')
  const lineSeq = useRef(0)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    setSaving(false)
    lineSeq.current = 1
    setSplitLines([
      {
        id: 'l1',
        categoryId: item?.expense_category?.id != null ? String(item.expense_category.id) : '',
        amount: item?.amount != null ? String(Number(item.amount)) : '',
      },
    ])
    setMode('fleet')
    setFleetLabel('')
    setLedgerId('')
    Promise.all([
      expenseCategoriesApi.list().catch(() => []),
      vehiclesApi.listKeys().catch(() => []),
      ledgerVehiclesApi.list().catch(() => []),
    ])
      .then(([c, f, l]) => {
        if (!active) return
        setCategories(c || [])
        setFleet(f || [])
        setLedger(l || [])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [isOpen, item])

  const fleetOptions = useMemo(
    () => fleet.map((v) => ({ label: `${v.code || v.id} — ${v.registration_plate || '—'}`, vehicle: v })),
    [fleet]
  )
  const fleetLabels = useMemo(() => fleetOptions.map((o) => o.label), [fleetOptions])
  const fleetByLabel = useMemo(() => new Map(fleetOptions.map((o) => [o.label, o.vehicle])), [fleetOptions])

  const ledgerOptions = useMemo(
    () => ledger.map((v) => ({ value: String(v.id), label: v.plate_raw ? `${v.plate_norm} (${v.plate_raw})` : v.plate_norm })),
    [ledger]
  )

  const isExpense = kind === 'expense'
  const mission = isExpense ? item?.mission_vehicle?.mission : item?.mission
  const label = isExpense ? item?.source_column : item?.vehicle_type_raw || item?.vehicle_label
  const dismissLabel = item?.vehicle_label || t('missions.treatNoLabel')

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: `${c.name_fr} (${c.code})` })),
    [categories]
  )

  const round2 = (n) => Math.round(Number(n) * 100) / 100
  const totalAmount = Number(item?.amount || 0)
  const assigned = useMemo(
    () => round2(splitLines.reduce((a, l) => a + (Number(l.amount) || 0), 0)),
    [splitLines]
  )
  const remaining = round2(totalAmount - assigned)
  const balanced = Math.abs(remaining) < 0.01
  const splitsValid =
    splitLines.length > 0 &&
    splitLines.every((l) => l.categoryId && Number(l.amount) > 0) &&
    balanced

  const updateLine = (id, patch) =>
    setSplitLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const addLine = () =>
    setSplitLines((prev) => [...prev, { id: `l${++lineSeq.current}`, categoryId: '', amount: '' }])
  const removeLine = (id) =>
    setSplitLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isExpense) {
        if (!splitsValid) {
          showToast(t('missions.treatSplitMismatch', { total: totalAmount.toLocaleString('fr-MA') }), 'warning')
          return
        }
        const splits = splitLines.map((l) => ({
          category: categories.find((c) => String(c.id) === l.categoryId),
          amount: Number(l.amount),
        }))
        await missionsApi.resolveExpenseLine(item, splits)
        showToast(t('missions.treatExpenseDone', { om: mission?.om || '' }), 'success')
      } else if (mode === 'fleet') {
        const vehicle = fleetByLabel.get(fleetLabel)
        if (!vehicle) {
          showToast(t('missions.treatPickVehicle'), 'warning')
          return
        }
        await missionsApi.assignMissionVehicle(item, { vehicle })
        showToast(t('missions.treatVehicleDone', { om: mission?.om || '' }), 'success')
      } else if (mode === 'ledger') {
        const ledgerVehicle = ledger.find((v) => String(v.id) === ledgerId)
        if (!ledgerVehicle) {
          showToast(t('missions.treatPickVehicle'), 'warning')
          return
        }
        await missionsApi.assignMissionVehicle(item, { ledgerVehicle })
        showToast(t('missions.treatVehicleDone', { om: mission?.om || '' }), 'success')
      } else {
        await missionsApi.dismissUnknownVehicle(item?.vehicle_label)
        showToast(t('missions.treatDismissed', { label: dismissLabel }), 'success')
      }
      onSaved?.()
      onClose()
    } catch (err) {
      console.error('Review treatment failed:', err)
      showToast(t('missions.treatFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={saving}>
        {t('common.cancel')}
      </Button>
      <Button onClick={handleSave} loading={saving} disabled={loading || (isExpense && !splitsValid)}>
        {t('missions.treatApply')}
      </Button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isExpense ? t('missions.treatExpenseTitle') : t('missions.treatVehicleTitle')}
      description={isExpense ? t('missions.treatExpenseDesc') : t('missions.treatVehicleDesc')}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
          <SummaryRow label={t('missions.colOm')} value={mission?.om || '—'} />
          <SummaryRow label={t('missions.colDate')} value={mission?.date_depart ? formatDate(mission.date_depart) : '—'} />
          <SummaryRow label={isExpense ? t('missions.reviewColumn') : t('missions.reviewType')} value={label || '—'} />
          {isExpense ? (
            <>
              <SummaryRow label={t('missions.reviewLabel')} value={item?.parsed_label || '—'} />
              <SummaryRow label={t('missions.colAmount')} value={Number(item?.amount || 0).toLocaleString('fr-MA')} />
            </>
          ) : (
            <SummaryRow label={t('missions.reviewLabel')} value={item?.vehicle_label || '—'} />
          )}
        </div>

        {isExpense ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-muted-foreground">{t('missions.treatSplitTitle')}</span>
              <span className={`text-[12px] font-semibold ${balanced ? 'text-muted-foreground' : 'text-warning'}`}>
                {balanced
                  ? t('missions.treatSplitBalanced')
                  : t('missions.treatSplitRemaining', { remaining: remaining.toLocaleString('fr-MA') })}
              </span>
            </div>

            {splitLines.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <Select
                    value={l.categoryId}
                    onChange={(e) => updateLine(l.id, { categoryId: e.target.value })}
                    placeholder={t('missions.treatPickCategory')}
                    options={categoryOptions}
                  />
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.amount}
                    onChange={(e) => updateLine(l.id, { amount: e.target.value })}
                    placeholder={t('missions.treatAmount')}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(l.id)}
                  disabled={splitLines.length <= 1}
                  aria-label={t('missions.treatRemoveLine')}
                  className="rounded-md border border-border p-2.5 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash01 {...SF} className="h-4 w-4" />
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
              >
                <Plus {...SF} className="h-4 w-4" />
                {t('missions.treatAddLine')}
              </button>
              <span className="text-[12px] text-muted-foreground">
                {t('missions.treatSplitAssigned', {
                  assigned: assigned.toLocaleString('fr-MA'),
                  total: totalAmount.toLocaleString('fr-MA'),
                })}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <ModeButton active={mode === 'fleet'} onClick={() => setMode('fleet')}>
                {t('missions.treatModeFleet')}
              </ModeButton>
              <ModeButton active={mode === 'ledger'} onClick={() => setMode('ledger')}>
                {t('missions.treatModeLedger')}
              </ModeButton>
              <ModeButton active={mode === 'dismiss'} onClick={() => setMode('dismiss')}>
                {t('missions.treatModeDismiss')}
              </ModeButton>
            </div>

            {mode === 'fleet' && (
              <AutocompleteInput
                label={t('missions.treatFleetVehicle')}
                options={fleetLabels}
                value={fleetLabel}
                onChange={setFleetLabel}
                placeholder={t('missions.treatPickVehicle')}
              />
            )}

            {mode === 'ledger' && (
              <Select
                label={t('missions.treatLedgerPlate')}
                value={ledgerId}
                onChange={(e) => setLedgerId(e.target.value)}
                placeholder={t('missions.treatPickVehicle')}
                options={ledgerOptions}
              />
            )}

            {mode === 'dismiss' && (
              <div className="flex items-start gap-2 rounded-lg border border-border p-3" style={{ borderColor: 'hsl(var(--warning))', background: 'hsl(var(--warning) / 0.06)' }}>
                <Trash01 {...SF} className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                <p className="text-[13px] text-foreground">
                  {t('missions.treatDismissHint', { label: dismissLabel })}
                </p>
              </div>
            )}
          </div>
        )}

        {mode !== 'dismiss' && (
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <CheckCircle {...SF} className="h-3.5 w-3.5" />
            {t('missions.treatDurableHint')}
          </p>
        )}
      </div>
    </Modal>
  )
}
