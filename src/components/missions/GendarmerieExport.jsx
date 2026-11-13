import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Shield01,
  Download01 as Download,
  ArrowLeft,
  RefreshCw01,
  AlertTriangle,
} from '@untitledui/icons'
import { missionsApi } from '../../services/api'
import { missionExpenseLines, missionVehicleChip, missionDriver } from '../../utils/missions'
import {
  generateExportFilename,
  downloadFile,
  generateCSV,
  generateExcel,
  generatePDF,
} from '../../utils/parsers'
import { formatDate } from '../../utils/formatters'
import { useToast } from '../../context/ToastContext'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import {
  GENDARMERIE_COLUMNS,
  GENDARMERIE_CHARGE_CATEGORIES,
} from '../../constants/missionExportColumns'

const SF = { strokeWidth: 1.75, fill: 'none' }

const money2 = (n) =>
  (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// A gendarmerie escort is booked as its own mission_vehicle, and its driver/label
// mentions the escort ("ESCORTE GENDARME"). The escort's whole cost is
// gendarmerie-attributable — in particular its `frais de route`, which is the
// escort fee and would otherwise be dropped as an ordinary convoy road cost.
const isEscortVehicle = (mv) =>
  /escort|gendarm/i.test(mv?.driver_name || '') || /escort|gendarm/i.test(mv?.vehicle_label || '')

/**
 * "État escorte gendarmerie" export (spec §9, §11).
 *
 * Loads the missions flagged `gendarmerie_required` and offers two levels:
 *  - charge  → gendarmerie-attributable money: the `escorte_gendarmerie` /
 *              `gasoil` / `repas` lines on any vehicle, plus the **entire** cost
 *              of the escort vehicle itself (e.g. its `frais de route`).
 *  - mission → every line of the OM
 * Totals are computed from live data (never hardcoded): the sheet/DB move.
 */
export default function GendarmerieExport({ onBack }) {
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const [level, setLevel] = useState('charge')
  const [format, setFormat] = useState('xlsx')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    missionsApi
      .list({ gendarmerie: true })
      .then((data) => {
        if (active) setMissions(data || [])
      })
      .catch((err) => {
        console.error('Error loading gendarmerie missions:', err)
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [retryKey])

  const chargeCats = useMemo(() => new Set(GENDARMERIE_CHARGE_CATEGORIES), [])

  const computed = useMemo(
    () =>
      missions.map((m) => {
        const lines = missionExpenseLines(m)
        const chargeAmount = lines.reduce((s, l) => {
          const amount = Number(l.amount) || 0
          // The escort vehicle's whole cost is attributable; elsewhere only the
          // escort categories count.
          if (isEscortVehicle(l.mv)) return s + amount
          return s + (chargeCats.has(l.expense_category?.code) ? amount : 0)
        }, 0)
        const missionAmount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
        return { mission: m, chargeAmount, missionAmount }
      }),
    [missions, chargeCats]
  )

  const rows = useMemo(
    () =>
      computed
        .map((c) => ({
          id: c.mission.id,
          om: c.mission.om,
          date_depart: c.mission.date_depart,
          depart: c.mission.depart || '',
          destination: c.mission.destination || '',
          vehicle: missionVehicleChip(c.mission).label,
          driver: missionDriver(c.mission),
          amount: level === 'charge' ? c.chargeAmount : c.missionAmount,
        }))
        .filter((r) => r.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    [computed, level],
  )

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows])
  const omitted = useMemo(
    () => computed.filter((c) => (level === 'charge' ? c.chargeAmount === 0 : c.missionAmount === 0)).length,
    [computed, level]
  )

  const columns = useMemo(
    () => [
      { key: 'om', label: t('missions.colOm') },
      { key: 'date_depart', label: t('missions.colDate'), render: (r) => formatDate(r.date_depart) },
      { key: 'depart', label: t('missions.colDepart') },
      { key: 'destination', label: t('missions.colDestination') },
      { key: 'vehicle', label: t('missions.colVehicle') },
      { key: 'driver', label: t('missions.colDriver') },
      {
        key: 'amount',
        label: t('missions.colAmount'),
        render: (r) => <span className="font-semibold text-primary">{money2(r.amount)}</span>,
      },
    ],
    [t]
  )

  const handleGenerate = () => {
    if (rows.length === 0) {
      showToast(t('export.noVehiclesSelected'), 'warning')
      return
    }
    try {
      setGenerating(true)
      const cols = GENDARMERIE_COLUMNS.map((c) => ({ key: c.key, label: c.label }))
      const data = rows.map((r) => ({
        ...r,
        date_depart: r.date_depart ? String(r.date_depart).slice(0, 10) : '',
      }))
      const ext = format
      const filename = generateExportFilename(`SMG-Gendarmerie-${level}`, ext)

      if (format === 'csv') {
        downloadFile(generateCSV(data, cols), filename, 'text/csv')
      } else if (format === 'xlsx') {
        downloadFile(
          generateExcel(data, cols, 'Gendarmerie'),
          filename,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
      } else {
        downloadFile(generatePDF(data, cols, t('export.gendTitle')), filename, 'application/pdf')
      }
      showToast(t('export.exportedRows', { count: rows.length }), 'success')
    } catch (err) {
      console.error('Gendarmerie export failed:', err)
      showToast(t('export.exportFailed'), 'error')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-[15px] text-muted-foreground">
          <RefreshCw01 {...SF} className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <ErrorState
          title={t('export.failedToLoad')}
          description={t('ui.errorLoadDesc')}
          onRetry={() => setRetryKey((k) => k + 1)}
          retryText={t('ui.retry')}
        />
      </Card>
    )
  }

  if (missions.length === 0) {
    return (
      <Card>
        <EmptyState icon={Shield01} title={t('export.gendEmpty')} description={t('export.gendEmptyDesc')} />
        <div className="mt-5">
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft {...SF} className="h-4 w-4 mr-1.5" />
            {t('export.back')}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="mb-1 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Shield01 {...SF} className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg text-foreground">{t('export.gendTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('export.gendSubtitle')}</p>
        </div>
      </div>

      {/* Level toggle */}
      <div className="mt-5">
        <p className="mb-2 text-[13px] font-medium text-muted-foreground">{t('export.gendLevelTitle')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { key: 'charge', label: t('export.gendLevelCharge'), desc: t('export.gendLevelChargeDesc') },
            { key: 'mission', label: t('export.gendLevelMission'), desc: t('export.gendLevelMissionDesc') },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setLevel(opt.key)}
              className={`rounded-lg border p-4 text-left transition-all ${
                level === opt.key ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <div className="text-[15px] font-semibold text-foreground">{opt.label}</div>
              <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[20px] font-semibold text-foreground">{missions.length.toLocaleString('fr-MA')}</div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('missions.kpiGendarmerie')}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[20px] font-semibold text-foreground">{rows.length.toLocaleString('fr-MA')}</div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('export.gendRows')}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[20px] font-semibold text-primary">{money2(total)}</div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('export.gendTotal')}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[20px] font-semibold text-muted-foreground">{omitted.toLocaleString('fr-MA')}</div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('export.gendOmitted')}
          </div>
        </div>
      </div>

      {level === 'charge' && (
        <div
          className="mt-4 flex items-start gap-2 rounded-lg border p-3"
          style={{ borderColor: 'hsl(var(--warning))', background: 'hsl(var(--warning) / 0.06)' }}
        >
          <AlertTriangle {...SF} className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
          <p className="text-[13px] text-foreground">{t('export.gendExcludedHint')}</p>
        </div>
      )}

      {/* Preview */}
      <div className="mt-5 overflow-hidden rounded-lg border border-border">
        <Table columns={columns} data={rows} getRowKey={(r) => r.id} emptyMessage={t('ui.noData')} />
      </div>

      {/* Format */}
      <div className="mt-5">
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">{t('export.formatTitle')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { key: 'xlsx', label: 'Excel', desc: '.xlsx' },
            { key: 'csv', label: 'CSV', desc: '.csv' },
            { key: 'pdf', label: 'PDF', desc: '.pdf' },
          ].map((fmt) => (
            <button
              key={fmt.key}
              onClick={() => setFormat(fmt.key)}
              className={`rounded-lg border px-4 py-3 text-center transition-colors ${
                format === fmt.key ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <div className="text-[15px] font-semibold text-foreground">{fmt.label}</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">{fmt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft {...SF} className="h-4 w-4 mr-1.5" />
          {t('export.back')}
        </Button>
        <Button onClick={handleGenerate} loading={generating} disabled={rows.length === 0}>
          <Download {...SF} className="h-4 w-4 mr-1.5" />
          {generating ? t('export.generating') : t('export.generateBtn', { count: rows.length })}
        </Button>
      </div>
    </Card>
  )
}
