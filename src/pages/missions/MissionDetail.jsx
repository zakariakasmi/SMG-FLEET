import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Route as RouteIcon,
  Shield01,
  Truck01,
  User01,
  CoinsStacked01,
  AlertTriangle,
  RefreshCw01,
  Edit01,
  Trash01,
} from '@untitledui/icons'
import { missionsApi } from '../../services/api'
import { vehicleChip, missionExpenseLines, routeLabel, missionVehicleLines, lineDriverLabels, lineField, missionRowDriver } from '../../utils/missions'
import { formatDate } from '../../utils/formatters'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import ErrorState from '../../components/ui/ErrorState'
import { ConfirmModal } from '../../components/ui/Modal'
import ReviewTreatmentModal from '../../components/missions/ReviewTreatmentModal'

const SF = { strokeWidth: 1.75, fill: 'none' }

const money2 = (n) =>
  (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Category palette for the breakdown bar (Apple-HIG-ish accents).
const PALETTE = ['#0A84FF', '#30D158', '#FF9F0A', '#FF375F', '#BF5AF2', '#64D2FF', '#FFD60A', '#5E5CE6', '#FF6482', '#40C8E0']

const CHIP_STYLES = {
  fleet: 'bg-primary/10 text-primary',
  ledger: 'bg-warning/10 text-warning',
  unknown: 'bg-destructive/10 text-destructive',
  none: 'bg-muted text-muted-foreground',
}

function Chip({ kind, children, onClick, title }) {
  const cls = `inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${CHIP_STYLES[kind] || CHIP_STYLES.none}`
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} className={`${cls} transition-opacity hover:opacity-80`}>
        {children}
      </button>
    )
  }
  return <span className={cls}>{children}</span>
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[15px] text-foreground">{value || '-'}</div>
    </div>
  )
}

// Horizontal route/date timeline. Steps with no date are omitted.
function Timeline({ steps }) {
  const shown = steps.filter((s) => s.date)
  if (shown.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-y-3">
      {shown.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <div className="flex flex-col items-center px-1">
            <span className={`h-2.5 w-2.5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-border'}`} />
            <span className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</span>
            <span className="text-[13px] text-foreground">{formatDate(s.date)}</span>
          </div>
          {i < shown.length - 1 && <span className="mx-3 mb-5 h-px w-10 bg-border sm:w-16" />}
        </div>
      ))}
    </div>
  )
}

export default function MissionDetail() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = useAuth()
  const { showToast } = useToast()
  const canTreat = can('import')
  const canEdit = can('editMissions')
  const canDelete = can('deleteMissions')

  const [mission, setMission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [treat, setTreat] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    missionsApi
      .get(id)
      .then((data) => {
        if (active) setMission(data)
      })
      .catch((err) => {
        console.error('Error loading mission:', err)
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, retryKey])

  const expenseLines = useMemo(() => {
    if (!mission) return []
    return missionExpenseLines(mission).sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
  }, [mission])

  const breakdown = useMemo(() => {
    const byCat = new Map()
    let total = 0
    for (const line of expenseLines) {
      const key = line.expense_category?.name_fr || line.expense_category?.code || t('missions.uncategorized')
      if (!byCat.has(key)) byCat.set(key, { category: key, total: 0, count: 0 })
      const g = byCat.get(key)
      g.total += Number(line.amount) || 0
      g.count += 1
      total += Number(line.amount) || 0
    }
    const groups = [...byCat.values()].sort((a, b) => b.total - a.total)
    return { groups, total }
  }, [expenseLines, t])

  // Expenses regrouped per vehicle, with its subtotal, and — inside a vehicle
  // driven by several people — per driver, because the ledger stores each
  // driver's own expenses on his own row (a hotel room each, fuel for the main
  // driver). A vehicle without expenses is still listed (empty state).
  const expenseGroups = useMemo(() => {
    if (!mission) return []
    return missionVehicleLines(mission).map((line) => {
      const driverGroups = line.rows.map((mv) => {
        const rows = (mv.mission_expenses || [])
          .map((e) => ({ ...e, mv }))
          .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
        return {
          key: mv.id,
          driver: missionRowDriver(mv),
          rows,
          subtotal: rows.reduce((s, l) => s + (Number(l.amount) || 0), 0),
        }
      })
      return {
        mv: line.rows[0],
        drivers: lineDriverLabels(line),
        driverGroups,
        multiDriver: driverGroups.length > 1,
        subtotal: driverGroups.reduce((s, g) => s + g.subtotal, 0),
      }
    })
  }, [mission])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[15px] text-muted-foreground">
        <RefreshCw01 {...SF} className="h-4 w-4 animate-spin" />
        {t('common.loading')}
      </div>
    )
  }

  if (error || !mission) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/missions')}>
          <ArrowLeft {...SF} className="mr-1.5 h-4 w-4" />
          {t('missions.backToList')}
        </Button>
        <div className="rounded-md border border-border bg-card p-4">
          <ErrorState
            title={t('missions.failedToLoadOne')}
            description={t('ui.errorLoadDesc')}
            onRetry={() => setRetryKey((k) => k + 1)}
            retryText={t('ui.retry')}
          />
        </div>
      </div>
    )
  }

  const r = routeLabel(mission)
  const vehicles = mission.mission_vehicles || []
  // Rows the ledger split by driver (same vehicle, same everything else) are ONE
  // vehicle line driven by several people: list it once, with every driver.
  const vehicleLines = missionVehicleLines(mission)
  const vehicleRows = vehicleLines.map((line) => ({
    ...line.rows[0],
    // Type/observation may only be written on the first row of the group.
    vehicle_type_raw: lineField(line, (mv) => mv.vehicle_type_raw) || line.rows[0].vehicle_type_raw,
    observation: lineField(line, (mv) => mv.observation) || line.rows[0].observation,
    drivers: lineDriverLabels(line),
  }))
  // Description and nature of charge are identical on every vehicle row of a
  // mission, so they are surfaced once in the mission header instead of per row.
  const missionDescription = vehicles.map((v) => (v.description || '').trim()).find(Boolean) || ''
  const natureLabel = vehicles.some((v) => v.nature_de_charge === 'HORS GABARIT')
    ? t('missions.formNatureHorsGabarit')
    : vehicles.some((v) => v.nature_de_charge === 'NORMAL')
      ? t('missions.formNatureNormal')
      : '-'
  const reviewCount = expenseLines.filter((l) => l.needs_review).length
  const unknownCount = vehicleLines.filter((l) => !l.rows[0].vehicle_id && !l.rows[0].ledger_vehicle_id).length
  const isManual = (mission.source || 'manual') === 'manual'

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await missionsApi.remove(mission.id)
      showToast(t('missions.deleted'), 'success')
      navigate('/missions')
    } catch (err) {
      console.error('Error deleting mission:', err)
      showToast(err?.message || t('missions.deleteFailed'), 'error')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const openTreatExpense = (line) => {
    setTreat({
      kind: 'expense',
      item: {
        ...line,
        mission_vehicle: {
          id: line.mv?.id,
          mission: { id: mission.id, om: mission.om, date_depart: mission.date_depart },
        },
      },
    })
  }
  const openTreatVehicle = (mv) => {
    setTreat({
      kind: 'vehicle',
      item: { ...mv, mission: { id: mission.id, om: mission.om, date_depart: mission.date_depart } },
    })
  }

  const vehicleColumns = [
    {
      key: 'vehicle',
      label: t('missions.colVehicle'),
      render: (mv) => {
        const chip = vehicleChip(mv)
        if (chip.kind === 'fleet' && mv.vehicle?.code) {
          return (
            <Chip kind="fleet" title={t('missions.detailViewFleet')} onClick={() => navigate(`/vehicles/${mv.vehicle.code}`)}>
              {chip.label}
            </Chip>
          )
        }
        return <Chip kind={chip.kind}>{chip.label}</Chip>
      },
    },
    { key: 'vehicle_type_raw', label: t('missions.detailType'), render: (mv) => <span className="text-muted-foreground">{mv.category?.name || mv.vehicle_type_raw || '-'}</span> },
    { key: 'driver', label: t('missions.colDriver'), render: (mv) => mv.drivers?.length ? mv.drivers.join(', ') : mv.driver_name || mv.driver?.name || mv.driver_code || '-' },
    { key: 'bordereau', label: t('missions.detailBordereau'), render: (mv) => mv.bordereau || '-' },
    { key: 'distance', label: t('missions.detailDistance'), render: (mv) => (mv.distance != null ? Number(mv.distance).toLocaleString('fr-MA') : '-') },
    { key: 'duree', label: t('missions.detailDuree'), render: (mv) => (mv.duree != null ? String(mv.duree) : '-') },
    {
      key: 'action',
      label: '',
      render: (mv) =>
        !mv.vehicle_id && !mv.ledger_vehicle_id ? (
          <Button variant="secondary" size="sm" disabled={!canTreat} onClick={(e) => { e.stopPropagation(); openTreatVehicle(mv) }}>
            {t('missions.treatAction')}
          </Button>
        ) : null,
    },
  ]

  const expenseColumns = [
    { key: 'category', label: t('missions.detailCategory'), render: (line) => <span className="font-medium text-foreground">{line.expense_category?.name_fr || line.expense_category?.code || t('missions.uncategorized')}</span> },
    { key: 'source_column', label: t('missions.reviewColumn'), render: (line) => <span className="text-muted-foreground">{line.source_column || '-'}</span> },
    { key: 'parsed_label', label: t('missions.reviewLabel'), render: (line) => <span className="text-muted-foreground">{line.parsed_label || '-'}</span> },
    {
      key: 'amount',
      label: t('missions.colAmount'),
      render: (line) => (
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          {money2(line.amount)}
          {line.needs_review && <AlertTriangle {...SF} className="h-3.5 w-3.5 text-warning" />}
        </span>
      ),
    },
    {
      key: 'action',
      label: '',
      render: (line) =>
        line.needs_review ? (
          <Button variant="secondary" size="sm" disabled={!canTreat} onClick={(e) => { e.stopPropagation(); openTreatExpense(line) }}>
            {t('missions.treatAction')}
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate('/missions')}>
          <ArrowLeft {...SF} className="mr-1.5 h-4 w-4" />
          {t('missions.backToList')}
        </Button>
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="secondary" onClick={() => navigate(`/missions/${mission.id}/edit`)}>
                <Edit01 {...SF} className="mr-1.5 h-4 w-4" />
                {t('missions.detailEdit')}
              </Button>
            )}
            {canDelete && (
              <Button variant="secondary" onClick={() => setDeleteOpen(true)}>
                <Trash01 {...SF} className="mr-1.5 h-4 w-4" />
                {t('missions.detailDelete')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RouteIcon {...SF} className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{mission.om}</h1>
                {mission.gendarmerie_required && (
                  <Chip kind="fleet">
                    <Shield01 {...SF} className="mr-1 h-3.5 w-3.5" />
                    {t('missions.colGendarmerie')}
                  </Chip>
                )}
                <Chip kind={isManual ? 'fleet' : 'none'}>
                  {isManual ? t('missions.sourceManual') : t('missions.sourceImported')}
                </Chip>
              </div>
              <p className="mt-1 text-[15px] text-muted-foreground">
                {r.from} <span className="text-muted-foreground/60">→</span> {r.to}
                {r.via ? <span className="text-muted-foreground"> · {t('missions.via')} {r.via}</span> : null}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('missions.colAmount')}</div>
            <div className="text-2xl font-semibold text-primary">{money2(breakdown.total)}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-5 sm:grid-cols-4">
          <Field label={t('missions.colDate')} value={formatDate(mission.date_depart)} />
          <Field label={t('missions.detailDateArriver')} value={formatDate(mission.date_arriver)} />
          <Field label={t('missions.detailDateReglement')} value={formatDate(mission.date_reglement)} />
          <Field label={t('missions.detailVehiclesCount')} value={vehicleLines.length} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border pt-5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label={t('missions.formDescription')} value={missionDescription} />
          </div>
          <Field label={t('missions.formNature')} value={natureLabel} />
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('missions.detailTimeline')}</div>
          <Timeline
            steps={[
              { label: t('missions.colDate'), date: mission.date_depart },
              { label: t('missions.detailDateArriver'), date: mission.date_arriver },
              { label: t('missions.detailDateReglement'), date: mission.date_reglement },
            ]}
          />
        </div>
      </Card>

      {/* Review banner */}
      {(reviewCount > 0 || unknownCount > 0) && (
        <div
          className="flex items-start gap-2 rounded-lg border p-3"
          style={{ borderColor: 'hsl(var(--warning))', background: 'hsl(var(--warning) / 0.06)' }}
        >
          <AlertTriangle {...SF} className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
          <div className="text-[13px] text-foreground">
            <p>{t('missions.detailNeedsReview')}</p>
            {canTreat ? (
              <p className="text-muted-foreground">{t('missions.detailTreatHint')}</p>
            ) : (
              <p className="text-muted-foreground">{t('missions.treatNoPermission')}</p>
            )}
          </div>
        </div>
      )}

      {/* Vehicles */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Truck01 {...SF} className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg text-foreground">{t('missions.detailVehiclesTitle')}</h2>
        </div>
        <Table columns={vehicleColumns} data={vehicleRows} getRowKey={(mv) => mv.id} />
        <div className="mt-4 space-y-2">
          {vehicleRows.map((mv) => (
            <div key={mv.id} className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                <User01 {...SF} className="h-3.5 w-3.5" />
                {vehicleChip(mv).label} · {t('missions.detailObservation')}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[14px] text-foreground">
                {mv.observation || <span className="text-muted-foreground">{t('missions.detailNoObservation')}</span>}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Expenses */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <CoinsStacked01 {...SF} className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg text-foreground">{t('missions.detailExpensesTitle')}</h2>
        </div>

        {breakdown.groups.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-[14px] text-muted-foreground">
            {t('missions.detailNoExpenses')}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Breakdown bar + legend */}
            <div>
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('missions.detailBreakdown')}
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                {breakdown.groups.map((g, i) => (
                  <div
                    key={g.category}
                    className="h-full"
                    style={{ width: `${breakdown.total > 0 ? (g.total / breakdown.total) * 100 : 0}%`, background: PALETTE[i % PALETTE.length] }}
                    title={`${g.category}: ${money2(g.total)}`}
                  />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {breakdown.groups.map((g, i) => (
                  <div key={g.category} className="flex items-center gap-2 text-[13px]">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="flex-1 truncate text-foreground">{g.category}</span>
                    <span className="text-muted-foreground">{Math.round((g.total / (breakdown.total || 1)) * 100)}%</span>
                    <span className="w-24 text-right font-medium text-foreground">{money2(g.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expenses grouped per vehicle */}
            <div>
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('missions.detailByVehicle')}
              </div>
              <div className="space-y-6">
                {expenseGroups.map(({ mv, drivers, driverGroups, multiDriver, subtotal }) => {
                  const chip = vehicleChip(mv)
                  const driver = drivers?.length ? drivers.join(', ') : null
                  const expenseCount = driverGroups.reduce((s, g) => s + g.rows.length, 0)
                  return (
                    <div key={mv.id}>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Chip kind={chip.kind}>{chip.label}</Chip>
                          {driver && <span className="text-[13px] text-muted-foreground">{driver}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[13px]">
                          <span className="text-muted-foreground">{t('missions.detailSubtotal')}</span>
                          <span className="font-semibold text-foreground">{money2(subtotal)}</span>
                        </div>
                      </div>
                      {expenseCount === 0 ? (
                        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-[13px] text-muted-foreground">
                          {t('missions.detailVehicleNoExpenses')}
                        </div>
                      ) : multiDriver ? (
                        // One vehicle, several drivers: each one's own expenses
                        // (hotel each, fuel for the main driver) with his subtotal.
                        <div className="space-y-4">
                          {driverGroups.map((g) => (
                            <div key={g.key}>
                              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[13px] font-medium text-foreground">
                                  {g.driver || t('missions.formNoDriver')}
                                </span>
                                <span className="text-[13px] font-semibold text-foreground">{money2(g.subtotal)}</span>
                              </div>
                              {g.rows.length === 0 ? (
                                <div className="rounded-lg border border-border bg-muted/30 px-4 py-2 text-[12px] text-muted-foreground">
                                  {t('missions.detailVehicleNoExpenses')}
                                </div>
                              ) : (
                                <Table columns={expenseColumns} data={g.rows} getRowKey={(e) => e.id} />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Table columns={expenseColumns} data={driverGroups[0].rows} getRowKey={(e) => e.id} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-[15px] font-semibold text-foreground">{t('common.total')}</span>
              <span className="text-[18px] font-semibold text-primary">{money2(breakdown.total)}</span>
            </div>
          </div>
        )}
      </Card>

      <ReviewTreatmentModal
        isOpen={treat != null}
        kind={treat?.kind}
        item={treat?.item}
        onClose={() => setTreat(null)}
        onSaved={() => setRetryKey((k) => k + 1)}
      />

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title={t('missions.deleteConfirmTitle')}
        message={`${t('missions.deleteConfirmBody', { om: mission.om })}${isManual ? '' : ' ' + t('missions.deleteConfirmImported')}`}
        confirmText={t('common.delete')}
      />
    </div>
  )
}
