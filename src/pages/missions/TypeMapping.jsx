import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Tag01, AlertTriangle, CheckCircle, RefreshCw01 } from '@untitledui/icons'
import { missionTypesApi, categoriesApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { PageSpinner } from '../../components/ui/Spinner'

const SF = { strokeWidth: 1.75, fill: 'none' }

// The ledger's "Type Véhicule" column is free text, so missions carry values
// like "VOITURE ESCORT", "benne 18T" or "PORTE CHAR -40T" that are not vehicle
// categories. Everything that could be resolved on its own already has been
// (exact category name, else the linked fleet vehicle's own category); this
// page is the wizard that asks a human about the rest.
//
// mission_vehicles.vehicle_type_raw is never rewritten — main-vehicle and escort
// detection in utils/missions reads it — only the category the UI shows moves.
function statusOf(r) {
  // `raw_norm` is '' (not null) for lines with no type text — they are a normal,
  // editable bucket, not a dead end.
  if (r.raw_norm == null) return 'no_text'
  if (r.alias_category_id) return 'alias'
  if (r.unresolved_rows > 0 || r.category_count > 1) return 'attention'
  return 'auto'
}

function StatusBadge({ status }) {
  const { t } = useTranslation()
  const styles = {
    attention: 'bg-warning/10 text-warning',
    alias: 'bg-primary/10 text-primary',
    auto: 'bg-success/10 text-success',
    no_text: 'bg-muted text-muted-foreground',
  }
  const labels = {
    attention: t('missions.typeWizard.statusNeeds'),
    alias: t('missions.typeWizard.statusAlias'),
    auto: t('missions.typeWizard.statusAuto'),
    no_text: t('missions.typeWizard.statusNoText'),
  }
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export default function TypeMapping() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { can } = useAuth()
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState({})
  const [busyKey, setBusyKey] = useState(null)

  const canWrite = can('import')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [report, cats] = await Promise.all([missionTypesApi.report(), categoriesApi.list()])
      setRows(report)
      setCategories(cats)
      setDraft({})
    } catch (err) {
      console.error('Type mapping load failed:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, retryKey])

  const categoryOptions = useMemo(
    () =>
      categories
        .map((c) => ({ value: String(c.id), label: c.name }))
        .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [categories]
  )
  const idByName = useMemo(() => new Map(categories.map((c) => [c.name, c.id])), [categories])

  // What the dropdown should start on: the operator's saved decision, else the
  // single category this type already resolves to (ambiguous ones start empty so
  // nobody silently confirms a guess).
  const defaultFor = (r) => {
    if (r.alias_category_id) return String(r.alias_category_id)
    const names = (r.category_names || '').split(', ').filter(Boolean)
    if (names.length === 1 && idByName.has(names[0])) return String(idByName.get(names[0]))
    return ''
  }
  const selectedFor = (r) => draft[r.raw_norm] ?? defaultFor(r)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        (r.sample || '').toLowerCase().includes(q) ||
        (r.raw_norm || '').includes(q) ||
        (r.category_names || '').toLowerCase().includes(q)
    )
  }, [rows, search])

  const needs = visible.filter((r) => statusOf(r) === 'attention')
  const rest = visible.filter((r) => statusOf(r) !== 'attention')
  const needsLines = needs.reduce((sum, r) => sum + Number(r.unresolved_rows || 0), 0)
  const totalLines = rows.reduce((sum, r) => sum + Number(r.row_count || 0), 0)

  const applyRow = async (r) => {
    const categoryId = selectedFor(r)
    if (!categoryId) {
      showToast(t('missions.typeWizard.pickCategory'), 'warning')
      return
    }
    try {
      setBusyKey(r.raw_norm)
      const count = await missionTypesApi.apply(r.raw_norm, Number(categoryId))
      showToast(t('missions.typeWizard.applied', { type: r.sample || r.raw_norm, count }), 'success')
      await load()
    } catch (err) {
      console.error('Type mapping apply failed:', err)
      showToast(t('missions.typeWizard.applyFailed'), 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const clearRow = async (r) => {
    try {
      setBusyKey(r.raw_norm)
      await missionTypesApi.clear(r.raw_norm)
      showToast(t('missions.typeWizard.cleared', { type: r.sample || r.raw_norm }), 'success')
      await load()
    } catch (err) {
      console.error('Type mapping clear failed:', err)
      showToast(t('missions.typeWizard.clearFailed'), 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const renderRow = (r) => {
    const status = statusOf(r)
    const mappable = r.raw_norm != null && canWrite
    const value = selectedFor(r)
    const busy = busyKey === r.raw_norm
    return (
      <div
        key={r.raw_norm || '__empty__'}
        className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-foreground">{r.sample || t('missions.typeWizard.noText')}</span>
            <StatusBadge status={status} />
          </div>
          {r.category_names && (
            <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
              {t('missions.typeWizard.currentlyIs', { names: r.category_names })}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:w-24">
          <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
            {t('missions.typeWizard.colLines')}
          </span>
          <span className="text-sm tabular-nums text-foreground">{Number(r.row_count).toLocaleString('fr-MA')}</span>
          {Number(r.unresolved_rows) > 0 && (
            <span className="text-[12px] font-semibold text-warning">
              ({Number(r.unresolved_rows).toLocaleString('fr-MA')} {t('missions.typeWizard.unmappedShort')})
            </span>
          )}
        </div>

        <div className="w-full shrink-0 sm:w-60">
          <Select
            aria-label={t('missions.typeWizard.colDecision')}
            options={categoryOptions}
            value={value}
            placeholder={t('missions.typeWizard.choose')}
            disabled={!mappable || busy}
            onChange={(e) => setDraft((prev) => ({ ...prev, [r.raw_norm]: e.target.value }))}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => applyRow(r)}
            loading={busy}
            disabled={!mappable || !value || busy}
          >
            {t('missions.typeWizard.apply')}
          </Button>
          {r.alias_category_id && (
            <Button size="sm" variant="ghost" onClick={() => clearRow(r)} disabled={!canWrite || busy}>
              {t('missions.typeWizard.reset')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  const listHeader = (
    <div className="hidden gap-4 border-b border-border px-4 py-2.5 sm:flex">
      <div className="flex-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t('missions.typeWizard.colType')}
      </div>
      <div className="w-24 shrink-0 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t('missions.typeWizard.colLines')}
      </div>
      <div className="w-60 shrink-0 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t('missions.typeWizard.colDecision')}
      </div>
      <div className="w-32 shrink-0" />
    </div>
  )

  let body
  if (loading) {
    body = <PageSpinner message={t('missions.typeWizard.loading')} />
  } else if (error) {
    body = (
      <ErrorState
        title={t('missions.typeWizard.failedToLoad')}
        description={t('ui.errorLoadDesc')}
        onRetry={() => setRetryKey((k) => k + 1)}
        retryText={t('ui.retry')}
      />
    )
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        icon={Tag01}
        title={t('missions.typeWizard.emptyTitle')}
        description={t('missions.typeWizard.emptyDesc')}
      />
    )
  } else {
    body = (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <Input
            label={t('missions.typeWizard.search')}
            placeholder={t('missions.typeWizard.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Card padding={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <AlertTriangle {...SF} className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">{t('missions.typeWizard.needsTitle')}</h2>
                <p className="text-[13px] text-muted-foreground">
                  {t('missions.typeWizard.needsDesc', { values: needs.length, lines: needsLines })}
                </p>
              </div>
            </div>
          </div>
          {needs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t('missions.typeWizard.allMapped')}
            </p>
          ) : (
            <>
              {listHeader}
              {needs.map(renderRow)}
            </>
          )}
        </Card>

        <Card padding={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                <CheckCircle {...SF} className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">{t('missions.typeWizard.restTitle')}</h2>
                <p className="text-[13px] text-muted-foreground">
                  {t('missions.typeWizard.restDesc', { values: rest.length, lines: totalLines })}
                </p>
              </div>
            </div>
          </div>
          {rest.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t('missions.typeWizard.noMatches', { search })}
            </p>
          ) : (
            <>
              {listHeader}
              {rest.map(renderRow)}
            </>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Tag01 {...SF} className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('missions.typeWizard.title')}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{t('missions.typeWizard.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/missions')}>
            <ArrowLeft {...SF} className="mr-1.5 h-4 w-4" />
            {t('missions.typeWizard.back')}
          </Button>
          <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
            <RefreshCw01 {...SF} className="mr-1.5 h-4 w-4" />
            {t('missions.typeWizard.refresh')}
          </Button>
        </div>
      </div>

      {!canWrite && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-medium text-warning">
          {t('missions.typeWizard.readOnly')}
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
        {t('missions.typeWizard.hint')}
      </div>

      {body}
    </div>
  )
}
