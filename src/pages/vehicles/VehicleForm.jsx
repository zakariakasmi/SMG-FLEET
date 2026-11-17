import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, useFormState } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Truck01 as Truck, Wallet01 as Wallet } from '@untitledui/icons'
import { useTranslation } from 'react-i18next'
import { vehiclesApi, categoriesApi, vehicleTypesApi, fuelTypesApi, chargesApi, chargeTypesApi } from '../../services/api'
import { vehicleSchema } from '../../utils/validation'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useYear } from '../../context/YearContext'
import { useUnsaved } from '../../components/ui/UnsavedChangesGuard'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { PageSpinner } from '../../components/ui/Spinner'
import ChargeAmountFields from '../../components/vehicles/ChargeAmountFields'
import VehicleInfoFields from '../../components/vehicles/VehicleInfoFields'

const SF = { strokeWidth: 1.75, fill: 'none' }

const StepIndicator = ({ t, step }) => {
  const steps = [
    { key: 1, label: t('vehicles.stepInfo'), icon: Truck },
    { key: 2, label: t('vehicles.stepCharges'), icon: Wallet },
  ]

  return (
    <div className="flex items-center gap-3">
      {steps.map((s, i) => {
        const Icon = s.icon
        const active = step === s.key
        const done = step > s.key
        return (
          <div key={s.key} className="flex items-center gap-3">
            {i > 0 && (
              <div
                className={`h-px w-10 ${done || active ? 'bg-primary' : 'bg-border'}`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  active || done
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                <Icon {...SF} className="w-4 h-4" />
              </div>
              <span
                className={`text-sm font-medium ${active || done ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {s.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function VehicleForm() {
  const { t } = useTranslation()
  const { code } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { can } = useAuth()
  const { selectedYear } = useYear()
  const { setDirty, markSaved, showGuard } = useUnsaved()
  const canEditChargesStep = can('charges') && (can('addCharges') || can('editCharges'))

  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState([])
  const [initialLoading, setInitialLoading] = useState(!!code)
  const [vehicleId, setVehicleId] = useState(null)

  const [existingTypes, setExistingTypes] = useState([])
  const [existingBrands, setExistingBrands] = useState([])
  const [existingCategories, setExistingCategories] = useState([])
  const [fuelTypes, setFuelTypes] = useState([])

  const [step, setStep] = useState(1)
  const [chargeTypes, setChargeTypes] = useState([])
  const [chargeValues, setChargeValues] = useState({})
  const [chargesLoading, setChargesLoading] = useState(false)

  const isEdit = !!code

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      code: '',
      registration_plate: '',
      ww_plate: '',
      vehicle_type: '',
      brand: '',
      fuel_type: '',
      purchase_date: '',
      puissance_fiscale: '',
      ptac: '',
      category_id: '',
      status: 'active',
      notes: '',
    },
  })

  const { isDirty } = useFormState({ control })

  useEffect(() => { setDirty(isDirty) }, [isDirty, setDirty])

  useEffect(() => {
    const initialize = async () => {
      await loadOptions()
      if (code) {
        await loadVehicle()
      } else {
        const cloneId = searchParams.get('clone')
        if (cloneId) {
          await loadVehicleForClone(cloneId)
        }
      }
    }
    initialize()
  }, [code])

  const loadOptions = async () => {
    try {
      const categoriesData = await categoriesApi.list()
      setCategories(categoriesData || [])
      setExistingCategories((categoriesData || []).map(c => c.name))

      const [typesData, vehiclesData, fuelData] = await Promise.all([
        vehicleTypesApi.list(),
        vehiclesApi.list(),
        fuelTypesApi.list(),
      ])

      setExistingTypes((typesData || []).map(t => t.name))
      setFuelTypes(fuelData || [])

      const brands = [...new Set((vehiclesData || []).map(v => v.brand).filter(Boolean))]
      setExistingBrands(brands)
    } catch (error) {
      console.error('Error loading options:', error)
    }
  }

  const loadVehicle = async () => {
    try {
      setInitialLoading(true)
      const vehicle = await vehiclesApi.getByCode(code)
      setVehicleId(vehicle.id)

      const categoryName = vehicle.category?.name || ''

      reset({
        code: vehicle.code,
        registration_plate: vehicle.registration_plate,
        ww_plate: vehicle.ww_plate || '',
        vehicle_type: vehicle.vehicle_type,
        brand: vehicle.brand,
        fuel_type: vehicle.fuel_type,
        purchase_date: vehicle.purchase_date,
        puissance_fiscale: vehicle.puissance_fiscale || '',
        ptac: vehicle.ptac || '',
        category_id: categoryName,
        status: vehicle.status,
        notes: vehicle.notes || '',
      })
    } catch (error) {
      showToast(t('vehicles.failedToLoadVehicle'), 'error')
      console.error('Error loading vehicle:', error)
      navigate('/vehicles')
    } finally {
      setInitialLoading(false)
    }
  }

  const loadVehicleForClone = async (cloneId) => {
    try {
      const vehicle = await vehiclesApi.getById(cloneId)
      reset({
        code: '',
        registration_plate: vehicle.registration_plate,
        ww_plate: vehicle.ww_plate || '',
        vehicle_type: vehicle.vehicle_type,
        brand: vehicle.brand,
        fuel_type: vehicle.fuel_type,
        purchase_date: vehicle.purchase_date,
        puissance_fiscale: vehicle.puissance_fiscale || '',
        ptac: vehicle.ptac || '',
        category_id: vehicle.category_id || '',
        status: 'active',
        notes: vehicle.notes || '',
      })
    } catch (error) {
      console.error('Error loading vehicle for clone:', error)
    }
  }

  const resolveCategoryId = async (rawCategoryId) => {
    let categoryId = rawCategoryId

    if (categoryId && typeof categoryId === 'string') {
      const trimmed = categoryId.trim()
      if (!trimmed) {
        showToast(t('vehicles.categoryRequired'), 'error')
        return null
      }

      if (!isNaN(Number(trimmed)) && trimmed !== '') {
        categoryId = Number(trimmed)
      } else {
        const existingCategory = categories.find(c => c.name.toLowerCase() === trimmed.toLowerCase())

        if (existingCategory) {
          categoryId = existingCategory.id
        } else {
          try {
            const newCategory = await categoriesApi.create({ name: trimmed })
            categoryId = newCategory.id
            showToast(t('vehicles.categoryCreated', { name: trimmed }), 'success')
            loadOptions()
          } catch (error) {
            console.error('Category create error:', error)
            showToast(t('vehicles.categoryCreateFailed', { error: error?.message || 'Unknown error' }), 'error')
            return null
          }
        }
      }
    }

    return Number(categoryId)
  }

  const resolveFuelTypeId = async (rawName) => {
    if (!rawName) return null
    const name = String(rawName).trim()
    const existing = fuelTypes.find((f) => f.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing.id
    try {
      const created = await fuelTypesApi.create({ name })
      setFuelTypes((prev) => [...prev, created])
      showToast(t('vehicles.fuelTypeCreated', { name }), 'success')
      return created.id
    } catch (error) {
      console.error('Fuel type create error:', error)
      showToast(t('vehicles.fuelTypeCreateFailed'), 'error')
      return null
    }
  }

  const resolveVehicleType = async (rawName) => {
    if (!rawName) return null
    try {
      const type = await vehicleTypesApi.resolveByName(rawName)
      if (type) {
        setExistingTypes((prev) =>
          prev.some((n) => n.toLowerCase() === type.name.toLowerCase()) ? prev : [...prev, type.name]
        )
      }
      return type
    } catch (error) {
      console.error('Vehicle type create error:', error)
      showToast(t('vehicles.vehicleTypeCreateFailed'), 'error')
      return null
    }
  }

  const saveVehicle = async (data) => {
    const categoryId = await resolveCategoryId(data.category_id)
    if (categoryId === null) return null
    const fuelTypeId = await resolveFuelTypeId(data.fuel_type)
    if (fuelTypeId === null) return null
    const vehicleType = await resolveVehicleType(data.vehicle_type)
    if (vehicleType === null) return null

    const vehicleData = {
      ...data,
      ww_plate: data.ww_plate?.trim() || null,
      vehicle_type: vehicleType.name,
      type_id: vehicleType.id,
      purchase_date: data.purchase_date || null,
      category_id: Number(categoryId),
      fuel_type_id: fuelTypeId,
      puissance_fiscale: data.puissance_fiscale ? Number(data.puissance_fiscale) : null,
      ptac: data.ptac ? Number(data.ptac) : null,
    }

    if (isEdit) {
      await vehiclesApi.update(vehicleId, vehicleData)
      showToast(t('vehicles.vehicleUpdated'), 'success')
      return vehicleId
    } else {
      const created = await vehiclesApi.create(vehicleData)
      showToast(t('vehicles.vehicleCreated'), 'success')
      return created.id
    }
  }

  const goToCharges = handleSubmit(async (data) => {
    try {
      setLoading(true)
      const id = await saveVehicle(data)
      if (id === null) return
      setVehicleId(id)
      markSaved()
      if (!canEditChargesStep) {
        navigate(-1)
        return
      }
      await loadChargesForStep(id)
      setStep(2)
    } catch (error) {
      showToast(error.message || t('vehicles.failedToSave'), 'error')
      console.error('Error saving vehicle:', error)
    } finally {
      setLoading(false)
    }
  })

  const loadChargesForStep = async (vid) => {
    try {
      setChargesLoading(true)
      const types = await chargeTypesApi.list()
      setChargeTypes(types || [])

      const existing = vid ? await chargesApi.list({ vehicleId: vid, year: selectedYear }) : []
      const map = {}
      ;(existing || []).forEach((c) => {
        map[String(c.charge_type_id)] = c.amount?.toString() || ''
      })
      setChargeValues(map)
    } catch (error) {
      console.error('Error loading charges:', error)
    } finally {
      setChargesLoading(false)
    }
  }

  const handleValueChange = (id, value) => {
    setChargeValues((prev) => ({ ...prev, [id]: value }))
  }

  const saveCharges = async () => {
    try {
      setLoading(true)
      const rows = chargeTypes
        .filter((ct) => {
          const raw = (chargeValues[String(ct.id)] || '').trim()
          return raw !== '' && Number(raw) > 0
        })
        .map((ct) => ({
          vehicle_id: Number(vehicleId),
          charge_type_id: Number(ct.id),
          amount: Number(chargeValues[String(ct.id)]),
          year: selectedYear,
        }))

      if (rows.length > 0) {
        await chargesApi.upsertBatch(rows)
      }
      showToast(t('charges.chargeUpdated'), 'success')
      markSaved()
      navigate(-1)
    } catch (error) {
      showToast(error.message || t('charges.failedToUpdate'), 'error')
      console.error('Error saving charges:', error)
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return <PageSpinner message={t('vehicles.loadingVehicle')} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => {
          if (step === 2) {
            setStep(1)
          } else {
            showGuard(() => navigate(-1))
          }
        }}>
          <ArrowLeft {...SF} className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>
      </div>

      {/* Form */}
      <Card>
        <h1 className="text-2xl font-bold mb-2 text-foreground">
          {isEdit ? t('vehicles.editVehicle') : t('vehicles.addVehicle')}
        </h1>
        {canEditChargesStep ? (
          <div className="mb-8">
            <StepIndicator t={t} step={step} />
          </div>
        ) : (
          <div className="mb-6" />
        )}

        {step === 1 || !canEditChargesStep ? (
          <form onSubmit={goToCharges} className="space-y-6">
            <VehicleInfoFields
              t={t}
              register={register}
              control={control}
              errors={errors}
              existingTypes={existingTypes}
              existingBrands={existingBrands}
              existingCategories={existingCategories}
              existingFuelTypes={fuelTypes.map((f) => f.name)}
              codeDisabled={isEdit}
            />

            <div className="flex gap-3 pt-4 border-t border-border">
              <Button type="submit" loading={loading}>
                {canEditChargesStep ? t('common.next') : t('common.save')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => showGuard(() => navigate(-1))}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            {chargesLoading ? (
              <PageSpinner message={t('common.loading')} />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t('vehicles.stepChargesDesc')}
                </p>
                <ChargeAmountFields
                  chargeTypes={chargeTypes}
                  values={chargeValues}
                  onValueChange={handleValueChange}
                />
                <p className="text-sm text-muted-foreground">
                  {t('charges.editChargesHint')}
                </p>
                <div className="flex gap-3 pt-4 border-t border-border">
                  <Button type="submit" onClick={saveCharges} loading={loading}>
                    {t('common.save')}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                    {t('common.back')}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}