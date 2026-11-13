import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Upload01 as Upload,
  File01,
  Trash01,
  ArrowLeft,
  ArrowRight,
  Eye,
  AlertCircle,
  AlertTriangle,
  RefreshCw01,
} from '@untitledui/icons'
import { parseImportFile } from '../../utils/parsers'
import { vehiclesApi, expenseCategoriesApi, importVehicleOverridesApi, expenseOverridesApi, importLogsApi } from '../../services/api'
import { buildLedgerImport, toIsoDate } from '../../utils/ledgerImport'
import { runLedgerImport } from '../../utils/runLedgerImport'
import { useToast } from '../../context/ToastContext'
import Button from '../../components/ui/Button'
import FileUpload from '../../components/ui/FileUpload'
import Card from '../../components/ui/Card'

const SF = { strokeWidth: 1.75, fill: 'none' }
const LEDGER_START = '2025-01-01'
const REVIEW_PREVIEW = 25

const money = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const count = (n) => (Number(n) || 0).toLocaleString('fr-MA')

const STATUS_LABEL = {
  exact: 'import.ledgerStatusExact',
  unparseable: 'import.ledgerStatusUnparseable',
  'no-fit': 'import.ledgerStatusNoFit',
}

/**
 * Missions RTC — relevé 2025 importer.
 *
 * Self-contained sub-wizard used by Import.jsx when `importType === 'ledger'`.
 * Upload sheet → review (parse + join, no mapping step) → write → result.
 */
export default function LedgerImport({ onChangeType, importType }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [sheetNames, setSheetNames] = useState([])
  const [rowsBySheet, setRowsBySheet] = useState(null)
  const [selectedSheet, setSelectedSheet] = useState(null)
  const [rows, setRows] = useState([])

  const [building, setBuilding] = useState(false)
  const [built, setBuilt] = useState(null)

  const [committing, setCommitting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [report, setReport] = useState(null)

  const [showAllWarnings, setShowAllWarnings] = useState(false)

  const resetSession = () => {
    setStep('upload')
    setFile(null)
    setRows([])
    setRowsBySheet(null)
    setSheetNames([])
    setSelectedSheet(null)
    setBuilt(null)
    setReport(null)
    setProgress({ done: 0, total: 0 })
    setShowAllWarnings(false)
  }

  const handleFileSelected = async (selectedFile, errorMsg) => {
    if (errorMsg) {
      showToast(errorMsg, 'error')
      return
    }
    if (!selectedFile) return
    setFile(selectedFile)
    setRows([])
    setRowsBySheet(null)
    setSheetNames([])
    setSelectedSheet(null)
    setBuilt(null)
    setReport(null)
    setParsing(true)
    try {
      const parsed = await parseImportFile(selectedFile)
      const sheetList = parsed.sheetNames || []
      setSheetNames(sheetList)
      setRowsBySheet(parsed.rowsBySheet || null)
      if (sheetList.length > 0) {
        // The ledger lives on the `2025` tab; prefer it when present.
        const preferred = sheetList.find((s) => String(s).trim() === '2025') || parsed.selectedSheet || sheetList[0]
        setSelectedSheet(preferred)
        setRows(parsed.rowsBySheet?.[preferred] || parsed.rows || [])
      } else {
        setSelectedSheet(null)
        setRows(parsed.rows || [])
      }
      if ((parsed.rows || []).length === 0) showToast(t('import.emptyFile'), 'warning')
    } catch (err) {
      showToast(err?.code === 'UNSUPPORTED' ? t('import.unsupportedFormat') : t('import.parseError'), 'error')
    } finally {
      setParsing(false)
    }
  }

  const handleSheetChange = (name) => {
    if (!rowsBySheet) return
    setSelectedSheet(name)
    setRows(rowsBySheet[name] || [])
    setBuilt(null)
  }

  const inScopeRows = () => rows.filter((r) => {
    const d = toIsoDate(r['Date depart'])
    return d && d >= LEDGER_START
  })

  const startReview = async () => {
    const scoped = inScopeRows()
    if (scoped.length === 0) {
      showToast(t('import.ledgerNoRows'), 'warning')
      return
    }
    setBuilding(true)
    try {
      const [categories, fleetVehicles, overrides, expenseOverrides] = await Promise.all([
        expenseCategoriesApi.list(),
        vehiclesApi.listKeys(),
        importVehicleOverridesApi.list(),
        expenseOverridesApi.list(),
      ])
      // Reference reads are gated by the `missions` scope (RLS). A user who can
      // reach this page via `import` but lacks `missions` reads zero rows —
      // fail loudly instead of importing nothing.
      if (categories.length === 0) {
        showToast(t('import.ledgerNoReference'), 'error')
        return
      }
      const res = buildLedgerImport(scoped, { fleetVehicles, overrides, expenseOverrides, expenseCategories: categories })
      setBuilt(res)
      setStep('review')
    } catch (err) {
      console.error('Ledger build failed:', err)
      showToast(t('import.ledgerBuildError'), 'error')
    } finally {
      setBuilding(false)
    }
  }

  const commit = async () => {
    if (!built) return
    if (built.problems?.length > 0) {
      console.error('Ledger import blocked by problems:', built.problems.slice(0, 20))
      showToast(t('import.ledgerProblems', { count: built.problems.length }), 'error')
      return
    }
    setCommitting(true)
    setProgress({ done: 0, total: 0 })
    try {
      const res = await runLedgerImport(built, { onProgress: setProgress })
      setReport(res)
      try {
        await importLogsApi.create({
          filename: file?.name || '',
          total_rows: built.totals.rows,
          added_count: res.missions,
          updated_count: 0,
          failed_count: res.warnings.length,
          error_details: {
            type: 'ledger',
            missions: res.missions,
            mission_vehicles: res.missionVehicles,
            mission_expenses: res.expenses,
            needs_review: built.totals.needsReviewLines,
            warnings: res.warnings.slice(0, 200),
          },
        })
      } catch (e) {
        console.log('Failed to log ledger import:', e)
      }
      setStep('result')
    } catch (err) {
      console.error('Ledger import failed:', err)
      const detail = err?.message || err?.details || (err ? String(err) : '')
      showToast(detail ? `${t('import.ledgerImportFailed')} — ${detail}` : t('import.ledgerImportFailed'), 'error')
      // Record the failure so it is visible without opening the browser console.
      try {
        await importLogsApi.create({
          filename: file?.name || '',
          total_rows: built.totals.rows,
          added_count: 0,
          updated_count: 0,
          failed_count: 1,
          error_details: {
            type: 'ledger',
            status: 'failed',
            step: progress?.step || null,
            message: String(detail).slice(0, 1000),
          },
        })
      } catch (e) {
        console.log('Failed to log ledger import failure:', e)
      }
    } finally {
      setCommitting(false)
      setProgress({ done: 0, total: 0 })
    }
  }

  // --------------------------------------------------
  // Upload
  // --------------------------------------------------
  const renderUpload = () => (
    <Card>
      <h2 className="mb-4 text-lg" style={{ color: 'hsl(var(--foreground))' }}>
        {t('import.uploadTypeTitle')}
      </h2>

      <div className="mb-6 flex gap-2 rounded-lg bg-muted/40 p-1">
        {[
          { key: 'vehicles', label: t('import.vehicles') },
          { key: 'charges', label: t('import.charges') },
          { key: 'ledger', label: t('import.ledger') },
        ].map((x) => (
          <button
            key={x.key}
            onClick={() => x.key !== 'ledger' && onChangeType(x.key)}
            className={`flex-1 rounded-md px-4 py-2.5 text-[15px] font-medium transition-all ${
              importType === x.key ? 'bg-primary text-primary-foreground shadow-sm' : ''
            }`}
            style={importType !== x.key ? { color: 'hsl(var(--muted-foreground))' } : undefined}
          >
            {x.label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {t('import.ledgerDesc')}
      </p>

      <FileUpload
        accept=".csv,.xlsx,.xls"
        onChange={handleFileSelected}
        label={t('import.uploadLabel')}
        description={t('import.uploadDescription')}
      />

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <File01 {...SF} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-foreground">{file.name}</p>
              <p className="text-[13px] text-muted-foreground">
                {t('import.fileSize')}: {(file.size / 1024).toFixed(1)} KB
                {sheetNames.length > 0 && ` · ${sheetNames.length} ${t('import.sheetsFound')}`}
              </p>
            </div>
          </div>
          <button
            onClick={resetSession}
            className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('import.remove')}
          >
            <Trash01 {...SF} className="h-4 w-4" />
          </button>
        </div>
      )}

      {sheetNames.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 text-[14px] font-medium text-foreground">{t('import.chooseSheet')}</p>
          <div className="flex flex-wrap gap-2">
            {sheetNames.map((name) => (
              <button
                key={name}
                onClick={() => handleSheetChange(name)}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition-all ${
                  selectedSheet === name
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-3">
        {rows.length > 0 && (
          <span className="text-[13px] font-medium text-muted-foreground">
            {count(rows.length)} {t('import.rowsCount')}
          </span>
        )}
        <Button onClick={startReview} loading={parsing || building} disabled={!file || parsing || rows.length === 0}>
          {t('import.continue')}
          <ArrowRight {...SF} className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </Card>
  )

  // --------------------------------------------------
  // Review
  // --------------------------------------------------
  const renderReview = () => {
    if (!built) return null
    const tt = built.totals
    const reviewRecords = built.catchRecords.filter((r) => r.status !== 'exact')
    const bucketOrder = ['A', 'B', 'C', 'neither', 'ambiguous']
    const bucketLabel = {
      A: t('import.ledgerBucketA'),
      B: t('import.ledgerBucketB'),
      C: t('import.ledgerBucketC'),
      neither: t('import.ledgerBucketNeither'),
      ambiguous: t('import.ledgerBucketAmbiguous'),
    }

    const chips = [
      { key: 'rows', label: t('import.ledgerInScope'), value: count(tt.rows), fg: 'hsl(var(--foreground))' },
      { key: 'missions', label: t('import.ledgerMissions'), value: count(tt.missions), fg: 'hsl(var(--foreground))' },
      { key: 'vehicles', label: t('import.ledgerVehicles'), value: count(tt.missionVehicles), fg: 'hsl(var(--foreground))' },
      { key: 'lines', label: t('import.ledgerExpenseLines'), value: count(tt.expenseLines), fg: 'hsl(var(--foreground))' },
      { key: 'drivers', label: t('import.ledgerDrivers'), value: count(tt.drivers), fg: 'hsl(var(--foreground))' },
      { key: 'ledger', label: t('import.ledgerNewPlates'), value: count(tt.ledgerVehicles), fg: 'hsl(var(--primary))' },
      { key: 'review', label: t('import.ledgerNeedsReview'), value: count(tt.needsReviewLines), fg: 'hsl(var(--warning))' },
    ]

    const warnings = built.warnings
    const visibleWarnings = showAllWarnings ? warnings : warnings.slice(0, 5)

    return (
      <>
        <Card>
          <div className="mb-1">
            <h2 className="text-lg" style={{ color: 'hsl(var(--foreground))' }}>{t('import.ledgerPreviewTitle')}</h2>
            <p className="mt-1 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('import.ledgerPreviewSubtitle')}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {chips.map((chip) => (
              <div key={chip.key} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-[20px] font-semibold" style={{ color: chip.fg }}>{chip.value}</div>
                <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{chip.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('import.ledgerFixedTotal')}</div>
              <div className="mt-1 text-[18px] font-semibold text-foreground">{money(tt.fixedTotal)} MAD</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('import.ledgerCatchTotal')}</div>
              <div className="mt-1 text-[18px] font-semibold text-foreground">{money(tt.catchTotal)} MAD</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('import.ledgerGrandTotal')}</div>
              <div className="mt-1 text-[18px] font-semibold" style={{ color: 'hsl(var(--primary))' }}>{money(tt.grandTotal)} MAD</div>
            </div>
          </div>

          {tt.sommeDelta !== 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border p-3" style={{ borderColor: 'hsl(var(--warning))', background: 'hsl(var(--warning) / 0.06)' }}>
              <AlertTriangle {...SF} className="h-4 w-4 flex-shrink-0 mt-0.5 text-warning" />
              <p className="text-sm text-foreground">
                {t('import.ledgerMismatch', { delta: money(tt.sommeDelta), sheet: money(tt.sommeTotal), raw: money(tt.grandTotal) })}
              </p>
            </div>
          )}

          <div className="mt-5">
            <h3 className="mb-2 text-[15px] font-semibold text-foreground">{t('import.ledgerBucketsTitle')}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {bucketOrder.filter((b) => built.buckets[b]).map((b) => (
                <div key={b} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-[13px] font-medium" style={{ color: b === 'neither' || b === 'ambiguous' ? 'hsl(var(--warning))' : 'hsl(var(--foreground))' }}>
                    {bucketLabel[b]}
                  </div>
                  <div className="mt-1 text-[15px] font-semibold text-foreground">{count(built.buckets[b].rows)}</div>
                  <div className="text-[12px] text-muted-foreground">{money(built.buckets[b].amount)} MAD</div>
                </div>
              ))}
            </div>
          </div>

          {reviewRecords.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-[15px] font-semibold text-foreground">
                {t('import.ledgerReviewTitle', { count: reviewRecords.length })}
              </h3>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                <table className="min-w-full">
                  <thead className="sticky top-0 z-10 bg-muted/80">
                    <tr>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.ledgerColOm')}</th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.ledgerColDate')}</th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.ledgerColColumn')}</th>
                      <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.ledgerColAmount')}</th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.ledgerColReason')}</th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.ledgerColObservation')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRecords.slice(0, REVIEW_PREVIEW).map((r, i) => (
                      <tr key={i} className="hover:bg-muted/40" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                        <td className="px-4 py-2 text-[13px] font-medium text-foreground">{r.om}</td>
                        <td className="px-4 py-2 text-[13px] text-foreground">{toIsoDate(r.date)}</td>
                        <td className="px-4 py-2 text-[13px] text-muted-foreground">{r.col}</td>
                        <td className="px-4 py-2 text-right text-[13px] font-medium text-foreground">{money(r.booked)}</td>
                        <td className="px-4 py-2 text-[13px] text-destructive">{t(STATUS_LABEL[r.status] || 'import.ledgerStatusNoFit')}</td>
                        <td className="max-w-[280px] truncate px-4 py-2 text-[13px] text-muted-foreground" title={r.obs}>{r.obs || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {reviewRecords.length > REVIEW_PREVIEW && (
                  <div className="bg-muted/40 px-4 py-2 text-center text-[13px] font-medium text-muted-foreground">
                    +{reviewRecords.length - REVIEW_PREVIEW} …
                  </div>
                )}
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mt-5 rounded-lg border border-border p-4">
              <div className="flex items-start gap-2">
                <AlertCircle {...SF} className="h-4 w-4 flex-shrink-0 mt-0.5 text-warning" />
                <div className="min-w-0 text-sm text-foreground">
                  <p className="font-medium">{t('import.ledgerWarningsTitle', { count: warnings.length })}</p>
                  <p className="mt-1 text-muted-foreground">{t('import.ledgerWarningsHint')}</p>
                  <ul className="mt-2 space-y-0.5 text-[13px] text-muted-foreground">
                    {visibleWarnings.map((w, i) => (
                      <li key={i}>
                        {w.type === 'plateless'
                          ? t('import.ledgerWarningPlateless', { om: w.om, date: w.date })
                          : w.type === 'fleet-duplicate'
                            ? t('import.ledgerWarningFleetDup', { plate: w.plate_norm })
                            : w.type === 'bad-date'
                              ? t('import.ledgerWarningBadDate', { om: w.om, field: w.field, raw: w.raw })
                              : JSON.stringify(w)}
                      </li>
                    ))}
                  </ul>
                  {warnings.length > 5 && (
                    <button
                      className="mt-2 text-[13px] font-medium text-primary hover:underline"
                      onClick={() => setShowAllWarnings((v) => !v)}
                    >
                      {showAllWarnings ? t('import.ledgerShowLess') : t('import.ledgerShowAll', { count: warnings.length })}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-lg" style={{ color: 'hsl(var(--foreground))' }}>{t('import.confirmTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('import.ledgerConfirmSubtitle')}</p>

          <div className="mt-4 space-y-1 text-[15px]">
            <p className="font-medium text-foreground">{t('import.ledgerConfirmMissions', { count: count(tt.missions) })}</p>
            <p className="font-medium text-foreground">{t('import.ledgerConfirmVehicles', { count: count(tt.missionVehicles) })}</p>
            <p className="font-medium text-foreground">{t('import.ledgerConfirmExpenses', { count: count(tt.expenseLines) })}</p>
            {tt.needsReviewLines > 0 && (
              <p className="font-medium" style={{ color: 'hsl(var(--warning))' }}>
                {t('import.ledgerConfirmReview', { count: count(tt.needsReviewLines), amount: money(tt.needsReviewAmount) })}
              </p>
            )}
          </div>

          {committing ? (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <RefreshCw01 {...SF} className="h-4 w-4 animate-spin" />
                {t('import.processing', { done: count(progress.done), total: count(progress.total) })}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-150"
                  style={{ width: progress.total > 0 ? `${Math.round((progress.done / progress.total) * 100)}%` : '100%' }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-5 flex items-center justify-between">
              <Button variant="secondary" onClick={resetSession} disabled={committing}>
                <ArrowLeft {...SF} className="h-4 w-4 mr-1.5" />
                {t('import.back')}
              </Button>
              <Button onClick={commit} disabled={committing}>
                <Upload {...SF} className="h-4 w-4 mr-1.5" />
                {t('import.ledgerImportBtn')}
              </Button>
            </div>
          )}
        </Card>
      </>
    )
  }

  // --------------------------------------------------
  // Result
  // --------------------------------------------------
  const renderResult = () => {
    if (!report) return null
    const stats = [
      { key: 'missions', label: t('import.ledgerMissions'), value: report.missions, color: 'hsl(var(--success))' },
      { key: 'vehicles', label: t('import.ledgerVehicles'), value: report.missionVehicles, color: 'hsl(var(--primary))' },
      { key: 'expenses', label: t('import.ledgerExpenseLines'), value: report.expenses, color: 'hsl(var(--foreground))' },
      { key: 'drivers', label: t('import.ledgerDrivers'), value: report.drivers, color: 'hsl(var(--foreground))' },
      { key: 'ledger', label: t('import.ledgerNewPlates'), value: report.ledgerVehicles, color: 'hsl(var(--primary))' },
      {
        key: 'warnings',
        label: t('import.ledgerWarnings'),
        value: report.warnings.length,
        color: report.warnings.length > 0 ? 'hsl(var(--warning))' : 'hsl(var(--success))',
      },
    ]

    return (
      <Card>
        <div className="mb-1">
          <h2 className="text-lg" style={{ color: 'hsl(var(--foreground))' }}>{t('import.ledgerResultTitle')}</h2>
          <p className="mt-1 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{file?.name || ''}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.key} className="rounded-lg border border-border bg-muted/30 p-4 text-center">
              <div className="text-2xl font-semibold" style={{ color: s.color }}>{count(s.value)}</div>
              <div className="mt-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" onClick={resetSession}>
            <Upload {...SF} className="h-4 w-4 mr-1.5" />
            {t('import.newImport')}
          </Button>
          <Button onClick={() => navigate('/missions')}>
            <Eye {...SF} className="h-4 w-4 mr-1.5" />
            {t('import.ledgerViewMissions')}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <>
      {step === 'upload' && renderUpload()}
      {step === 'review' && renderReview()}
      {step === 'result' && renderResult()}
    </>
  )
}
