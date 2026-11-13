import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Users01,
  AlertTriangle,
  CheckCircle,
  RefreshCw01,
} from '@untitledui/icons'
import { driversApi } from '../../services/api'
import { normName } from '../../utils/ledgerImport'
import { DRIVER_MERGE_CANDIDATES } from '../../constants/driverMergeCandidates'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'

const SF = { strokeWidth: 1.75, fill: 'none' }

function ConfidenceBadge({ confidence }) {
  const { t } = useTranslation()
  const high = confidence === 'high'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
        high ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
      }`}
    >
      {high ? t('missions.driverMergeHigh') : t('missions.driverMergeLow')}
    </span>
  )
}

/**
 * Driver merge tool (spec §13.1, Appendix A). Read-only suggestion list; a human
 * picks the survivor and the rest are folded into it. Never auto-applies.
 * Writes need the `import` scope (RLS), so the actions are gated on `can('import')`.
 */
export default function DriverMerge() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { can } = useAuth()
  const navigate = useNavigate()

  const [drivers, setDrivers] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [choices, setChoices] = useState({})
  const [busyKey, setBusyKey] = useState(null)

  const canWrite = can('import')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    Promise.all([driversApi.list(), driversApi.counts()])
      .then(([d, c]) => {
        if (!active) return
        setDrivers(d || [])
        setCounts(c || {})
      })
      .catch((err) => {
        console.error('Error loading drivers:', err)
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [retryKey])

  const groups = useMemo(() => {
    const byNorm = new Map(drivers.map((d) => [d.name_norm, d]))
    return DRIVER_MERGE_CANDIDATES.map((c, i) => {
      const present = c.names.map((n) => byNorm.get(normName(n))).filter(Boolean)
      return { key: `${i}-${c.confidence}`, confidence: c.confidence, names: c.names, present }
    }).filter((g) => g.present.length >= 2)
  }, [drivers])

  const countOf = (driver) => counts[driver.id] || 0

  // Surviving driver defaults to the dominant spelling (most mission_vehicles).
  const defaultSurvivorId = (group) =>
    [...group.present].sort((a, b) => countOf(b) - countOf(a))[0]?.id

  const survivorIdFor = (group) => choices[group.key] ?? defaultSurvivorId(group)

  const reload = async () => {
    const [d, c] = await Promise.all([driversApi.list(), driversApi.counts()])
    setDrivers(d || [])
    setCounts(c || {})
    setChoices({})
  }

  const handleMerge = async (group) => {
    const survivorId = survivorIdFor(group)
    const survivor = group.present.find((d) => d.id === survivorId)
    const losers = group.present.filter((d) => d.id !== survivorId)
    if (!survivor || losers.length === 0) return

    setBusyKey(group.key)
    try {
      for (const loser of losers) {
        await driversApi.merge(survivor, loser)
      }
      showToast(
        t('missions.driverMergeDone', { count: losers.length, name: survivor.name || survivor.code || survivor.id }),
        'success'
      )
      await reload()
    } catch (err) {
      console.error('Driver merge failed:', err)
      showToast(t('missions.driverMergeFailed'), 'error')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/missions')}>
        <ArrowLeft {...SF} className="mr-1.5 h-4 w-4" />
        {t('missions.backToList')}
      </Button>

      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users01 {...SF} className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('missions.driverMergeTitle')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('missions.driverMergeSubtitle')}</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <AlertTriangle {...SF} className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
        <p className="text-[13px] text-foreground">{t('missions.driverMergeIntro')}</p>
      </div>

      {!canWrite && (
        <div
          className="flex items-start gap-2 rounded-lg border p-3"
          style={{ borderColor: 'hsl(var(--warning))', background: 'hsl(var(--warning) / 0.06)' }}
        >
          <AlertTriangle {...SF} className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
          <p className="text-[13px] text-foreground">{t('missions.driverMergeNoPermission')}</p>
        </div>
      )}

      {error ? (
        <Card>
          <ErrorState
            title={t('missions.driverMergeFailedLoad')}
            description={t('ui.errorLoadDesc')}
            onRetry={() => setRetryKey((k) => k + 1)}
            retryText={t('ui.retry')}
          />
        </Card>
      ) : loading ? (
        <Card>
          <div className="flex items-center gap-2 text-[15px] text-muted-foreground">
            <RefreshCw01 {...SF} className="h-4 w-4 animate-spin" />
            {t('common.loading')}
          </div>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle}
            title={t('missions.driverMergeEmpty')}
            description={t('missions.driverMergeEmptyDesc')}
          />
        </Card>
      ) : (
        <>
          <p className="text-[13px] font-medium text-muted-foreground">
            {t('missions.driverMergeGroups', { count: groups.length })}
          </p>
          {groups.map((group) => {
            const survivorId = survivorIdFor(group)
            const losers = group.present.filter((d) => d.id !== survivorId)
            return (
              <Card key={group.key}>
                <div className="mb-3 flex items-center gap-2">
                  <ConfidenceBadge confidence={group.confidence} />
                  <h2 className="text-[15px] font-semibold text-foreground">
                    {group.present.map((d) => d.name || d.code).join('  ·  ')}
                  </h2>
                </div>

                <div className="space-y-2">
                  {group.present.map((driver) => {
                    const isSurvivor = driver.id === survivorId
                    return (
                      <button
                        key={driver.id}
                        type="button"
                        disabled={!canWrite || busyKey === group.key}
                        onClick={() => setChoices((prev) => ({ ...prev, [group.key]: driver.id }))}
                        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all disabled:opacity-60 ${
                          isSurvivor ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                            isSurvivor ? 'border-primary' : 'border-muted-foreground/40'
                          }`}
                        >
                          {isSurvivor && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                        </span>
                        <span className="flex-1">
                          <span className="text-[15px] font-medium text-foreground">{driver.name || '—'}</span>
                          <span className="ml-2 text-[13px] text-muted-foreground">
                            {driver.code ? `#${driver.code}` : t('missions.driverMergeNoCode')}
                          </span>
                        </span>
                        <span className="text-[12px] font-medium text-muted-foreground">
                          {t('missions.driverMergeCount', { count: countOf(driver) })}
                        </span>
                        <span
                          className={`text-[12px] font-semibold ${
                            isSurvivor ? 'text-primary' : 'text-warning'
                          }`}
                        >
                          {isSurvivor ? t('missions.driverMergeKeep') : t('missions.driverMergeFold')}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => handleMerge(group)}
                    loading={busyKey === group.key}
                    disabled={!canWrite || busyKey !== null}
                  >
                    {t('missions.driverMergeAction', { count: losers.length })}
                  </Button>
                </div>
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}
