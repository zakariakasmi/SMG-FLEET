import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Upload01 as Upload,
  File01,
  Trash01,
  ArrowLeft,
  ArrowRight,
  Eye,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw01,
  Download01 as Download,
  Columns01,
} from '@untitledui/icons'
import { parseImportFile, downloadFile, generateCSV } from '../../utils/parsers'
import {
  autoDetectMapping,
  validateMapping,
  buildValidationState,
  VEHICLE_TARGETS,
  CHARGE_BASE_TARGETS,
  isChargeTarget,
  IGNORE_TARGET,
} from '../../utils/importValidation'
import { vehiclesApi, chargesApi, chargeTypesApi, categoriesApi, fuelTypesApi, vehicleTypesApi, importLogsApi } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useYear } from '../../context/YearContext'
import Button from '../../components/ui/Button'
import FileUpload from '../../components/ui/FileUpload'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import ErrorState from '../../components/ui/ErrorState'
import Select from '../../components/ui/Select'

const SF = { strokeWidth: 1.75, fill: 'none' }
const PREVIEW_PAGE_SIZE = 10

const STEP_ORDER = ['upload', 'mapping', 'review', 'result']

const vehicleLabelByKey = Object.fromEntries(VEHICLE_TARGETS.map((x) => [x.key, x.labelKey]))

export default function Import() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { selectedYear } = useYear()

  const [step, setStep] = useState('upload')

  const [importType, setImportType] = useState('vehicles')
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [sheetNames, setSheetNames] = useState([])
  const [rowsBySheet, setRowsBySheet] = useState(null)
  const [selectedSheet, setSelectedSheet] = useState(null)
  const [rows, setRows] = useState([])

  const [mapping, setMapping] = useState([])
  const [previewFilter, setPreviewFilter] = useState('all')
  const [previewPage, setPreviewPage] = useState(1)

  const [refLoading, setRefLoading] = useState(true)
  const [refError, setRefError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [categories, setCategories] = useState([])
  const [vehicleKeys, setVehicleKeys] = useState([])
  const [chargeTypes, setChargeTypes] = useState([])

  const [committing, setCommitting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState(null)

  const [years, setYears] = useState([])
  const [renewSource, setRenewSource] = useState(null)
  const [renewing, setRenewing] = useState(false)

  useEffect(() => {
    chargesApi
      .listYears()
      .then((yrs) => {
        setYears(yrs)
        setRenewSource((prev) => prev ?? String(selectedYear))
      })
      .catch(() => {})
  }, [selectedYear])

  const handleRenew = async () => {
    const source = Number(renewSource)
    if (!source) return
    setRenewing(true)
    try {
      const res = await chargesApi.renewYear(source, source + 1)
      showToast(t('import.renewSuccess', { count: res.added, year: res.targetYear }), 'success')
      setYears(await chargesApi.listYears())
    } catch (e) {
      showToast(t('import.renewError'), 'error')
    } finally {
      setRenewing(false)
    }
  }

  useEffect(() => {
    let active = true
    setRefLoading(true)
    setRefError(false)

    Promise.all([
      categoriesApi.list().catch(() => null),
      vehiclesApi.listKeys().catch(() => null),
      chargeTypesApi.list().catch(() => null),
    ])
      .then(([cats, vehKeys, cts]) => {
        if (!active) return
        if (cats === null || vehKeys === null || cts === null) {
          setRefError(true)
          return
        }
        setCategories(cats)
        setVehicleKeys(vehKeys)
        setChargeTypes(cts)
      })
      .catch(() => {
        if (active) setRefError(true)
      })
      .finally(() => {
        if (active) setRefLoading(false)
      })

    return () => {
      active = false
    }
  }, [retryKey])

  const refData = useMemo(() => {
    const categoryById = new Map()
    const categoryIds = new Set()
    categories.forEach((c) => {
      categoryById.set(c.name.toLowerCase(), c.id)
      categoryIds.add(Number(c.id))
    })

    const vehicleByCode = new Map()
    const vehicleByPlate = new Map()
    const vehicleIdByCode = new Map()
    vehicleKeys.forEach((v) => {
      vehicleByCode.set(v.code.toUpperCase(), { id: v.id, code: v.code.toUpperCase() })
      vehicleByPlate.set(v.registration_plate.toUpperCase(), { id: v.id, code: v.code.toUpperCase() })
      vehicleIdByCode.set(v.code.toUpperCase(), v.id)
    })

    return { categoryById, categoryIds, vehicleByCode, vehicleByPlate, vehicleIdByCode }
  }, [categories, vehicleKeys])

  const headers = useMemo(() => {
    const first = rows[0]
    return first ? Object.keys(first)
      .map((h) => String(h).trim())
      .filter(Boolean) : []
  }, [rows])

  const mappingProblems = useMemo(() => validateMapping(mapping, importType), [mapping, importType])

  const validation = useMemo(() => {
    if (step === 'upload') return null
    return buildValidationState({ rawRows: rows, mapping, importType, refData })
  }, [step, rows, mapping, importType, refData])

  const pageTotal = useMemo(() => {
    if (!validation) return { filtered: [], totalPages: 1 }
    let filtered = validation.rows
    if (previewFilter === 'valid') {
      filtered = filtered.filter((r) => r.status === 'valid' || r.status === 'update')
    } else if (previewFilter === 'errors') {
      filtered = filtered.filter((r) => r.status === 'invalid')
    }
    return {
      filtered,
      totalPages: Math.max(1, Math.ceil(filtered.length / PREVIEW_PAGE_SIZE)),
    }
  }, [validation, previewFilter])

  const previewRows = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE
    return pageTotal.filtered.slice(start, start + PREVIEW_PAGE_SIZE)
  }, [pageTotal, previewPage])

  useEffect(() => {
    setPreviewPage(1)
  }, [previewFilter, rows, mapping])

  const resetSession = () => {
    setStep('upload')
    setFile(null)
    setRows([])
    setRowsBySheet(null)
    setSheetNames([])
    setSelectedSheet(null)
    setMapping([])
    setResult(null)
    setProgress({ done: 0, total: 0 })
    setPreviewFilter('all')
    setPreviewPage(1)
  }

  const switchType = (type) => {
    if (type === importType) return
    setImportType(type)
    resetSession()
    setStep('upload')
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
    setMapping([])
    setResult(null)
    setParsing(true)

    try {
      const parsed = await parseImportFile(selectedFile)
      const sheetList = parsed.sheetNames || []
      setSheetNames(sheetList)
      setRowsBySheet(parsed.rowsBySheet || null)
      if (sheetList.length > 0) {
        setSelectedSheet(parsed.selectedSheet || sheetList[0])
      } else {
        setSelectedSheet(null)
      }
      setRows(parsed.rows)
      if (parsed.rows.length === 0) {
        showToast(t('import.emptyFile'), 'warning')
      }
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
    setMapping([])
    setPreviewPage(1)
  }

  const startMapping = () => {
    if (rows.length === 0) {
      showToast(t('import.emptyFile'), 'warning')
      return
    }
    setMapping((prev) => (prev.length === headers.length ? prev : autoDetectMapping(headers, importType, chargeTypes)))
    setStep('mapping')
  }

  const updateMapping = (index, target) => {
    setMapping((prev) => prev.map((m, i) => (i === index ? { ...m, target, auto: false } : m)))
  }

  const canContinueMapping = mapping.length > 0 && mappingProblems.length === 0

  const mappingOptions = useMemo(() => {
    if (importType === 'vehicles') {
      return [
        { value: IGNORE_TARGET, label: t('import.ignoreColumn') },
        ...VEHICLE_TARGETS.map((x) => ({
          value: x.key,
          label: `${x.required ? '* ' : ''}${t(x.labelKey)}`,
        })),
      ]
    }
    return [
      { value: IGNORE_TARGET, label: t('import.ignoreColumn') },
      ...CHARGE_BASE_TARGETS.map((x) => ({
        value: x.key,
        label: `${x.required ? '* ' : ''}${t(x.labelKey)}`,
      })),
      ...chargeTypes.map((ct) => ({ value: `ct:${ct.id}`, label: ct.display_name || ct.name })),
    ]
  }, [importType, chargeTypes, t])

  const downloadErrors = (rowsWithErrors) => {
    const csvContent = generateCSV(
      rowsWithErrors.map((issue) => ({
        row: issue.rowNumber,
        code: issue.code || '',
        field: issue.fieldLabel || issue.field || '',
        error: issue.message || issue.error || '',
      })),
      [
        { key: 'row', label: 'Row' },
        { key: 'code', label: 'Code' },
        { key: 'field', label: 'Field' },
        { key: 'error', label: 'Error' },
      ]
    )
    downloadFile(csvContent, 'import-errors.csv', 'text/csv')
    showToast(t('import.errorLogDownloaded'), 'success')
  }

  const formatIssueList = () => {
    const list = []
    validation.rows.forEach((row) => {
      row.issues.forEach((iss) => {
        list.push({
          rowNumber: row.rowNumber,
          code: row.code || '',
          field: iss.field,
          fieldLabel: iss.field === 'code'
            ? t('import.fields.code')
            : importType === 'vehicles' && vehicleLabelByKey[iss.field]
              ? t(vehicleLabelByKey[iss.field])
              : t('import.chargeIssueField'),
          message: t(iss.key, { value: iss.value, code: iss.code, column: iss.column }),
        })
      })
    })
    return list
  }

  const commit = async () => {
    if (!validation) return

    setCommitting(true)
    setProgress({ done: 0, total: 0 })
    const failures = []

    const added = { count: 0 }
    const updated = { count: 0 }

    try {
      if (importType === 'vehicles') {
        const toProcess = validation.rows.filter((r) => r.status === 'valid' || r.status === 'update')
        setProgress({ done: 0, total: toProcess.length })

        // Resolve each fuel type once so imported vehicles stay linked to the
        // fuel_types reference instead of writing free text with a null FK.
        const fuelTypeCache = new Map()
        const resolveFuelType = async (rawName) => {
          const key = String(rawName ?? '').trim().toLowerCase()
          if (!key) return null
          if (!fuelTypeCache.has(key)) {
            fuelTypeCache.set(key, await fuelTypesApi.resolveByName(rawName))
          }
          return fuelTypeCache.get(key)
        }

        // Same for vehicle types: link to vehicle_types (Settings) so imported
        // vehicles never drift off the reference table.
        const vehicleTypeCache = new Map()
        const resolveVehicleType = async (rawName) => {
          const key = String(rawName ?? '').trim().toLowerCase()
          if (!key) return null
          if (!vehicleTypeCache.has(key)) {
            vehicleTypeCache.set(key, await vehicleTypesApi.resolveByName(rawName))
          }
          return vehicleTypeCache.get(key)
        }

        for (let i = 0; i < toProcess.length; i++) {
          const row = toProcess[i]
          setProgress({ done: i + 1, total: toProcess.length })
          try {
            const fuelType = await resolveFuelType(row.values.fuel_type)
            const vehicleType = await resolveVehicleType(row.values.vehicle_type)
            const payload = {
              code: row.values.code,
              registration_plate: row.values.registration_plate,
              vehicle_type: vehicleType?.name ?? row.values.vehicle_type,
              type_id: vehicleType?.id ?? null,
              brand: row.values.brand,
              fuel_type: fuelType?.name ?? row.values.fuel_type,
              fuel_type_id: fuelType?.id ?? null,
              purchase_date: row.values.purchase_date || null,
              category_id: row.values.categoryId,
              status: row.values.status,
              puissance_fiscale: row.values.puissance_fiscale,
              ptac: row.values.ptac,
              notes: row.values.notes,
            }
            if (row.status === 'update') {
              await vehiclesApi.update(row.existingId, payload)
              updated.count++
            } else {
              await vehiclesApi.create(payload)
              added.count++
            }
          } catch (err) {
            failures.push({
              rowNumber: row.rowNumber,
              code: row.code,
              message: err?.message || t('import.errors.commitFailed'),
            })
          }
        }
      } else {
        const allEntries = validation.rows.filter((r) => r.status !== 'invalid').flatMap((r) => r.entries)
        setProgress({ done: 0, total: allEntries.length })
        const BATCH_SIZE = 50

        for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
          const batch = allEntries.slice(i, i + BATCH_SIZE).map((e) => ({
            vehicle_id: e.vehicle_id,
            charge_type_id: e.charge_type_id,
            amount: e.amount,
            notes: e.notes,
            year: selectedYear,
          }))
          try {
            await chargesApi.upsertBatch(batch)
            added.count += batch.length
            setProgress({ done: Math.min(i + batch.length, allEntries.length), total: allEntries.length })
          } catch (err) {
            for (let j = i; j < Math.min(i + batch.length, allEntries.length); j++) {
              failures.push({
                rowNumber: allEntries[j].rowNumber,
                code: allEntries[j].code || '',
                message: err?.message || t('import.errors.commitFailed'),
              })
            }
          }
        }
      }

      const problemIssues = []
      validation.rows.forEach((row) => {
        row.issues.forEach((iss) => {
          problemIssues.push({
            rowNumber: row.rowNumber,
            code: row.code || '',
            field: iss.field,
            fieldLabel: iss.field === 'code' ? t('import.fields.code') : iss.field,
            message: t(iss.key, { value: iss.value, code: iss.code, column: iss.column }),
          })
        })
      })
      const errorDetails = [
        ...problemIssues,
        ...failures.map((f) => ({
          rowNumber: f.rowNumber,
          code: f.code || '',
          field: '',
          fieldLabel: '',
          message: f.message,
        })),
      ]

      const finalResult = {
        added: added.count,
        updated: updated.count,
        failed: failures.length,
        skipped: validation.summary.invalid,
        errors: failures,
      }
      setResult(finalResult)

      try {
        await importLogsApi.create({
          filename: file?.name || '',
          total_rows: rows.length,
          added_count: added.count,
          updated_count: updated.count,
          failed_count: finalResult.failed + finalResult.skipped,
          error_details: errorDetails.slice(0, 1000),
        })
      } catch (e) {
        console.log('Failed to log import:', e)
      }

      showToast(
        t('import.importComplete', {
          added: finalResult.added,
          updated: finalResult.updated,
          failed: finalResult.failed,
          skipped: finalResult.skipped,
        }),
        finalResult.failed + finalResult.skipped > 0 ? 'warning' : 'success'
      )

      setStep('result')
    } catch (err) {
      showToast(t('import.importFailed'), 'error')
      console.error('Import error:', err)
    } finally {
      setCommitting(false)
      setProgress({ done: 0, total: 0 })
    }
  }

  const handleDownloadTemplate = () => {
    if (importType === 'charges') {
      const headers = ['code', 'visite_technique', 'taxe_transport', 'taxe_essieu', 'chrono_tachygraphe', 'assurance']
      const csvContent = [
        headers.join(','),
        'T535,500,,350,,1200',
        'C322,620,7800,,,660',
        'M500,,350,,,',
      ].join('\n')
      downloadFile(csvContent, 'import-charges-template.csv', 'text/csv')
    } else {
      const headers = [
        'code',
        'registration_plate',
        'vehicle_type',
        'brand',
        'fuel_type',
        'purchase_date',
        'category',
        'status',
        'puissance_fiscale',
        'ptac',
        'notes',
      ]
      const csvContent = [
        headers.join(','),
        'T535,AB-12345,camion,Mercedes,Diesel,2020-03-15,camion benne 8x4,active,320,26000,"Véhicule de chantier"',
        'C320,CD-67890,camion,Volvo,Diesel,2019-11-20,plateau 12M,active,280,40000,',
        'M500,EF-11223,minibus,Iveco,Diesel,2021-06-10,minibus 30 places,sold,180,4600,',
      ].join('\n')
      downloadFile(csvContent, 'import-vehicles-template.csv', 'text/csv')
    }
    showToast(t('import.templateDownloaded'), 'success')
  }

  const issueList = useMemo(() => {
    if (!validation) return []
    return formatIssueList()
  }, [validation]) // eslint-disable-line react-hooks/exhaustive-deps

  const canContinueUpload = file && !parsing && rows.length > 0 && (sheetNames.length <= 1 || selectedSheet)

  const stepIndex = STEP_ORDER.indexOf(step)

  const stepperSteps = useMemo(
    () => [
      { key: 'upload', label: t('import.steps.upload'), icon: Upload },
      { key: 'mapping', label: t('import.steps.mapping'), icon: Columns01 },
      { key: 'review', label: t('import.steps.preview'), icon: Eye },
      { key: 'result', label: t('import.steps.result'), icon: CheckCircle },
    ],
    [t]
  )

  const headingColor = 'hsl(var(--foreground))'
  const mutedColor = 'hsl(var(--muted-foreground))'

  const renderUpload = () => (
    <Card>
      <h2 className="mb-4 text-lg" style={{ color: headingColor }}>
        {t('import.uploadTypeTitle')}
      </h2>

      <div className="mb-6 flex gap-2 rounded-lg bg-muted/40 p-1">
        <button
          onClick={() => switchType('vehicles')}
          className={`flex-1 rounded-md px-4 py-2.5 text-[15px] font-medium transition-all ${
            importType === 'vehicles' ? 'bg-primary text-primary-foreground shadow-sm' : ''
          }`}
          style={importType !== 'vehicles' ? { color: mutedColor } : undefined}
        >
          {t('import.vehicles')}
        </button>
        <button
          onClick={() => switchType('charges')}
          className={`flex-1 rounded-md px-4 py-2.5 text-[15px] font-medium transition-all ${
            importType === 'charges' ? 'bg-primary text-primary-foreground shadow-sm' : ''
          }`}
          style={importType !== 'charges' ? { color: mutedColor } : undefined}
        >
          {t('import.charges')}
        </button>
      </div>

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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download {...SF} className="h-4 w-4 mr-1.5" />
            {importType === 'charges' ? t('import.downloadChargeTemplate') : t('import.downloadTemplate')}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {rows.length > 0 && (
            <span className="text-[13px] font-medium text-muted-foreground">
              {rows.length.toLocaleString('fr-MA')} {t('import.rowsCount')}
            </span>
          )}
          <Button onClick={startMapping} loading={parsing} disabled={!canContinueUpload}>
            {t('import.continue')}
            <ArrowRight {...SF} className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </Card>
  )

  const renderMapping = () => (
    <Card>
      <div className="mb-1">
        <h2 className="text-lg" style={{ color: headingColor }}>{t('import.mappingTitle')}</h2>
        <p className="mt-1 text-sm" style={{ color: mutedColor }}>{t('import.mappingSubtitle')}</p>
      </div>

      {mappingProblems.length > 0 && (
        <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'hsl(var(--warning))', background: 'hsl(var(--warning) / 0.06)' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle {...SF} className="h-4 w-4 flex-shrink-0 mt-0.5 text-warning" />
            <div className="space-y-1 text-sm text-foreground">
              {mappingProblems.map((p, i) => {
                if (p.type === 'missingRequired') {
                  return (
                    <p key={i}>
                      {t('import.missingRequiredColumns', {
                        fields: p.targets.map((k) => t(vehicleLabelByKey[k])).join(', '),
                      })}
                    </p>
                  )
                }
                if (p.type === 'duplicate') {
                  return (
                    <p key={i}>
                      {t('import.duplicateMapping')}: {p.target.startsWith('ct:') ? t('import.chargeIssueField') : t(vehicleLabelByKey[p.target] || p.target)}
                    </p>
                  )
                }
                return <p key={i}>{t('import.needOneChargeColumn')}</p>
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-muted/60">
              <tr>
                <th scope="col" className="px-5 py-3 text-left text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t('import.fileColumn')}
                </th>
                <th scope="col" className="px-5 py-3 text-left text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t('import.sampleValue')}
                </th>
                <th scope="col" className="px-5 py-3 text-left text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t('import.targetField')}
                </th>
              </tr>
            </thead>
            <tbody>
              {mapping.map((m, index) => {
                const sample = rows[0] ? String(rows[0][m.header] ?? '-') : '-'
                const isRequired = importType === 'vehicles'
                  ? VEHICLE_TARGETS.find((x) => x.key === m.target)?.required || false
                  : m.target === 'code'
                return (
                  <tr key={m.header} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    <td className="px-5 py-3 text-[14px] font-medium text-foreground">{m.header}</td>
                    <td className="max-w-[220px] truncate px-5 py-3 text-[13px] text-muted-foreground" title={sample}>
                      {sample}
                    </td>
                    <td className="w-80 px-5 py-3">
                      <Select
                        value={m.target}
                        onChange={(e) => updateMapping(index, e.target.value)}
                        options={mappingOptions}
                        placeholder={t('import.mapToField')}
                      />
                      {isRequired && m.target && (
                        <span className="mt-1 inline-block text-[12px] font-medium text-primary">{t('import.required')}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <Button variant="secondary" onClick={() => setStep('upload')}>
          <ArrowLeft {...SF} className="h-4 w-4 mr-1.5" />
          {t('import.back')}
        </Button>
        <Button onClick={() => setStep('review')} disabled={!canContinueMapping}>
          {t('import.continue')}
          <ArrowRight {...SF} className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </Card>
  )

  const renderStatusBadge = (row) => {
    let cls = ''
    let label = ''
    let bg = ''
    if (row.status === 'update') {
      cls = 'hsl(var(--primary))'
      bg = 'hsl(var(--primary) / 0.12)'
      label = t('import.statusUpdate')
    } else if (row.status === 'invalid') {
      cls = 'hsl(var(--destructive))'
      bg = 'hsl(var(--destructive) / 0.12)'
      label = t('import.statusError')
    } else {
      cls = 'hsl(var(--success))'
      bg = 'hsl(var(--success) / 0.12)'
      label = importType === 'vehicles' ? t('import.statusCreate') : t('import.statusValid')
    }
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold"
        style={{ background: bg, color: cls }}
      >
        {row.status === 'invalid' ? (
          <AlertCircle {...SF} className="h-3.5 w-3.5" />
        ) : (
          <CheckCircle {...SF} className="h-3.5 w-3.5" />
        )}
        {label}
      </span>
    )
  }

  const previewColumns = useMemo(() => {
    if (importType === 'vehicles') {
      return [
        { key: 'rowNumber', label: t('import.rowCol'), render: (r) => <span className="font-medium text-foreground">#{r.rowNumber}</span> },
        { key: 'code', label: t('import.fields.code'), render: (r) => <span className="font-semibold text-foreground">{r.values.code || '-'}</span> },
        { key: 'registration_plate', label: t('import.fields.registration_plate'), render: (r) => r.values.registration_plate || '-' },
        { key: 'vehicle_type', label: t('import.fields.vehicle_type'), render: (r) => r.values.vehicle_type || '-' },
        { key: 'brand', label: t('import.fields.brand'), render: (r) => r.values.brand || '-' },
        { key: 'fuel_type', label: t('import.fields.fuel_type'), render: (r) => r.values.fuel_type || '-' },
        { key: 'purchase_date', label: t('import.fields.purchase_date'), render: (r) => r.values.purchase_date || '-' },
        { key: 'category', label: t('import.fields.category'), render: (r) => r.values.category || '-' },
        { key: 'state', label: t('import.statusCol'), render: renderStatusBadge },
      ]
    }
    return [
      { key: 'rowNumber', label: t('import.rowCol'), render: (r) => <span className="font-medium text-foreground">#{r.rowNumber}</span> },
      { key: 'code', label: t('import.fields.code'), render: (r) => <span className="font-semibold text-foreground">{r.code || '-'}</span> },
      ...chargeTypes.map((ct) => ({
        key: `ct:${ct.id}`,
        label: ct.display_name || ct.name,
        render: (r) => {
          const entry = (r.entries || []).find((e) => e.charge_type_id === ct.id)
          return entry ? entry.amount.toLocaleString('fr-FR') : '-'
        },
      })),
      { key: 'state', label: t('import.statusCol'), render: renderStatusBadge },
    ]
  }, [importType, t, chargeTypes])

  const renderReview = () => {
    if (!validation) return null
    const summary = validation.summary
    const validForImport = validation.rows.filter((r) => r.status === 'valid' || r.status === 'update').length

    const summaryChips = [
      { key: 'total', label: t('import.totalRows'), value: summary.total },
      { key: 'valid', label: t('import.validRows'), value: summary.valid },
      { key: 'invalid', label: t('import.invalidRows'), value: summary.invalid },
      { key: 'dups', label: t('import.duplicates'), value: summary.duplicates },
      { key: 'add', label: importType === 'vehicles' ? t('import.willImport') : t('import.chargeEntries'), value: summary.toAdd },
      { key: 'update', label: t('import.willUpdate'), value: summary.toUpdate },
      { key: 'skip', label: t('import.willSkip'), value: summary.toSkip },
    ]

    const chipColors = {
      invalid: { fg: 'hsl(var(--destructive))' },
      dups: { fg: 'hsl(var(--warning))' },
      add: { fg: 'hsl(var(--success))' },
      update: { fg: 'hsl(var(--primary))' },
      skip: { fg: 'hsl(var(--muted-foreground))' },
    }

    return (
      <>
        <Card>
          <div className="mb-1">
            <h2 className="text-lg" style={{ color: headingColor }}>{t('import.previewTitle')}</h2>
            <p className="mt-1 text-sm" style={{ color: mutedColor }}>{t('import.previewSubtitle')}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {summaryChips.map((chip) => (
              <div key={chip.key} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-[20px] font-semibold" style={{ color: chipColors[chip.key]?.fg || 'hsl(var(--foreground))' }}>
                  {chip.value.toLocaleString('fr-MA')}
                </div>
                <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{chip.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 mb-3 flex flex-wrap items-center gap-2">
            {[
              { key: 'all', label: t('import.filterAll') },
              { key: 'valid', label: t('import.filterValid') },
              { key: 'errors', label: t('import.filterErrors') },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setPreviewFilter(f.key)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
                  previewFilter === f.key
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Table
            columns={previewColumns}
            data={previewRows}
            getRowKey={(r) => r.rowNumber}
            pagination
            currentPage={previewPage}
            totalPages={pageTotal.totalPages}
            onPageChange={setPreviewPage}
            emptyMessage={previewFilter === 'errors' ? t('import.noErrors') : t('ui.noData')}
          />

          {issueList.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {t('import.validationErrorsTitle', { count: issueList.length })}
                </h3>
                <Button variant="secondary" size="sm" onClick={() => downloadErrors(issueList)}>
                  <Download {...SF} className="h-4 w-4 mr-1.5" />
                  {t('import.downloadErrorsPre')}
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                <table className="min-w-full">
                  <thead className="sticky top-0 z-10 bg-muted/80">
                    <tr>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.rowCol')}</th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.fields.code')}</th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.fieldCol')}</th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.reasonCol')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueList.slice(0, 40).map((iss, i) => (
                      <tr key={i} className="hover:bg-muted/40" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                        <td className="px-4 py-2 text-[13px] font-medium text-foreground">#{iss.rowNumber}</td>
                        <td className="px-4 py-2 text-[13px] text-foreground">{iss.code || '-'}</td>
                        <td className="px-4 py-2 text-[13px] text-muted-foreground">{iss.fieldLabel}</td>
                        <td className="px-4 py-2 text-[13px] text-destructive">{iss.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {issueList.length > 40 && (
                  <div className="bg-muted/40 px-4 py-2 text-center text-[13px] font-medium text-muted-foreground">
                    +{issueList.length - 40} ...
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-lg" style={{ color: headingColor }}>{t('import.confirmTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('import.confirmSubtitle')}</p>

          <div className="mt-4 space-y-2 text-[15px]">
            {importType === 'vehicles' ? (
              <>
                <p className="font-medium text-foreground">{t('import.confirmAdd', { count: summary.toAdd })}</p>
                <p className="font-medium text-foreground">{t('import.confirmUpdate', { count: summary.toUpdate })}</p>
                <p className="font-medium" style={{ color: 'hsl(var(--destructive))' }}>
                  {t('import.confirmSkip', { count: summary.toSkip })}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">{t('import.confirmChargeAdd', { count: summary.toAdd })}</p>
                <p className="font-medium" style={{ color: 'hsl(var(--destructive))' }}>
                  {t('import.confirmSkip', { count: summary.toSkip })}
                </p>
              </>
            )}
          </div>

          {summary.duplicates > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border p-3" style={{ borderColor: 'hsl(var(--warning))', background: 'hsl(var(--warning) / 0.06)' }}>
              <AlertTriangle {...SF} className="h-4 w-4 flex-shrink-0 mt-0.5 text-warning" />
              <p className="text-sm text-foreground">{t('import.confirmDuplicatesNotice')}</p>
            </div>
          )}

          {committing ? (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <RefreshCw01 {...SF} className="h-4 w-4 animate-spin" />
                {t('import.processing', { done: progress.done, total: progress.total })}
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
              <Button variant="secondary" onClick={() => setStep('mapping')} disabled={committing}>
                <ArrowLeft {...SF} className="h-4 w-4 mr-1.5" />
                {t('import.back')}
              </Button>
              <Button onClick={commit} disabled={!(validForImport > 0)}>
                <Upload {...SF} className="h-4 w-4 mr-1.5" />
                {t('import.importBtn')}
              </Button>
            </div>
          )}
        </Card>
      </>
    )
  }

  const renderResult = () => {
    if (!result) return null
    const stats = [
      { key: 'added', label: t('import.added'), value: result.added, color: 'hsl(var(--success))' },
      { key: 'updated', label: t('import.updated'), value: result.updated, color: 'hsl(var(--primary))' },
      { key: 'failed', label: t('import.failed'), value: result.failed, color: result.failed > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--success))' },
      { key: 'skipped', label: t('import.skipped'), value: result.skipped, color: result.skipped > 0 ? 'hsl(var(--warning))' : 'hsl(var(--muted-foreground))' },
    ]

    return (
      <Card>
        <div className="mb-1">
          <h2 className="text-lg" style={{ color: headingColor }}>{t('import.resultTitle')}</h2>
          <p className="mt-1 text-sm" style={{ color: mutedColor }}>{file?.name || ''}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.key} className="rounded-lg border border-border bg-muted/30 p-4 text-center">
              <div className="text-3xl font-semibold" style={{ color: s.color }}>{s.value.toLocaleString('fr-MA')}</div>
              <div className="mt-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {result.errors.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">{t('import.failedRows')}</h3>
              <Button variant="secondary" size="sm" onClick={() => downloadErrors(result.errors)}>
                <Download {...SF} className="h-4 w-4 mr-1.5" />
                {t('import.downloadErrorReport', { count: result.errors.length })}
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              <table className="min-w-full">
                <thead className="sticky top-0 z-10 bg-muted/80">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.rowCol')}</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.fields.code')}</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('import.reasonCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.slice(0, 50).map((err, i) => (
                    <tr key={i} className="hover:bg-muted/40" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                      <td className="px-4 py-2 text-[13px] font-medium text-foreground">#{err.rowNumber}</td>
                      <td className="px-4 py-2 text-[13px] text-foreground">{err.code || '-'}</td>
                      <td className="px-4 py-2 text-[13px] text-destructive">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" onClick={resetSession}>
            <Upload {...SF} className="h-4 w-4 mr-1.5" />
            {t('import.newImport')}
          </Button>
          <Button onClick={() => navigate('/vehicles')}>
            <Eye {...SF} className="h-4 w-4 mr-1.5" />
            {t('import.viewVehicles')}
          </Button>
        </div>
      </Card>
    )
  }

  if (refError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <h1 className="text-2xl font-bold" style={{ color: headingColor }}>{t('import.title')}</h1>
        <Card>
          <ErrorState
            title={t('import.loadReferenceError')}
            description={t('ui.errorLoadDesc')}
            onRetry={() => setRetryKey((k) => k + 1)}
            retryText={t('ui.retry')}
          />
        </Card>
      </div>
    )
  }

  if (refLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <h1 className="text-2xl font-bold" style={{ color: headingColor }}>{t('import.title')}</h1>
        <Card>
          <div className="space-y-3">
            <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: headingColor }}>{t('import.title')}</h1>
        <p className="mt-1 text-sm" style={{ color: mutedColor }}>{t('import.subtitle')}</p>
      </div>

      <>
      {/* Renew to next year */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{t('import.renewTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('import.renewDescription')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              label={t('import.renewYear')}
              value={renewSource ?? ''}
              onChange={(e) => setRenewSource(e.target.value)}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
              placeholder={t('import.renewYear')}
              className="w-28"
              disabled={renewing}
            />
            <Button size="sm" onClick={handleRenew} disabled={renewing || !renewSource}>
              <RefreshCw01 {...SF} className="h-4 w-4 mr-1.5" />
              {renewing ? t('import.renewLoading') : t('import.renewAction', { target: renewSource ? Number(renewSource) + 1 : '' })}
            </Button>
          </div>
        </div>
      </Card>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {stepperSteps.map((s, i) => {
          const Icon = s.icon
          const isActive = i === stepIndex
          const isDone = i < stepIndex
          const isClickable = i < stepIndex && i <= 2
          return (
            <div key={s.key} className="flex flex-1 items-center gap-1">
              <button
                onClick={() => isClickable && setStep(s.key)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition-all ${
                  isClickable ? 'cursor-pointer hover:bg-muted' : 'cursor-default'
                }`}
                style={{
                  color: isActive ? 'hsl(var(--primary))' : isDone ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={{
                    background: isActive ? 'hsl(var(--primary))' : isDone ? 'hsl(var(--success))' : 'hsl(var(--muted))',
                    color: isActive ? 'hsl(var(--primary-foreground))' : isDone ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {isDone ? <CheckCircle {...SF} className="h-3.5 w-3.5" /> : <Icon {...SF} className="h-3.5 w-3.5" />}
                </span>
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
              {i < stepperSteps.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          )
        })}
      </div>

      {step === 'upload' && renderUpload()}
      {step === 'mapping' && renderMapping()}
      {step === 'review' && renderReview()}
      {step === 'result' && renderResult()}
      </>
    </div>
  )
}