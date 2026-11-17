import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { vehiclesApi, categoriesApi, vehicleTypesApi, fuelTypesApi } from '../../services/api'
import { vehicleSchema } from '../../utils/validation'
import { useToast } from '../../context/ToastContext'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import VehicleInfoFields from './VehicleInfoFields'

const DEFAULT_VALUES = {
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
}

export default function EditVehicleModal({ vehicle, isOpen, onClose, onSuccess }) {
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [categories, setCategories] = useState([])
  const [existingTypes, setExistingTypes] = useState([])
  const [existingBrands, setExistingBrands] = useState([])
  const [fuelTypes, setFuelTypes] = useState([])

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(vehicleSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (!isOpen || !vehicle) return
    let cancelled = false
    setReady(false)

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
      category_id: vehicle.category?.name || vehicle.category_id || '',
      status: vehicle.status,
      notes: vehicle.notes || '',
    })

    const prepare = async () => {
      try {
        const [categoriesData, typesData, vehiclesData, fuelData] = await Promise.all([
          categoriesApi.list(),
          vehicleTypesApi.list(),
          vehiclesApi.list(),
          fuelTypesApi.list(),
        ])
        if (cancelled) return
        setCategories(categoriesData || [])
        setExistingTypes((typesData || []).map((x) => x.name))
        setFuelTypes(fuelData || [])
        setExistingBrands(
          [...new Set((vehiclesData || []).map((v) => v.brand).filter(Boolean))]
        )
      } catch (error) {
        console.error('Error loading options:', error)
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    prepare()

    return () => {
      cancelled = true
    }
  }, [isOpen, vehicle])

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
        const existingCategory = categories.find(
          (c) => c.name.toLowerCase() === trimmed.toLowerCase()
        )

        if (existingCategory) {
          categoryId = existingCategory.id
        } else {
          try {
            const newCategory = await categoriesApi.create({ name: trimmed })
            categoryId = newCategory.id
            showToast(t('vehicles.categoryCreated', { name: trimmed }), 'success')
          } catch (error) {
            console.error('Category create error:', error)
            showToast(
              t('vehicles.categoryCreateFailed', { error: error?.message || 'Unknown error' }),
              'error'
            )
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

  const handleSave = handleSubmit(async (data) => {
    try {
      setLoading(true)
      const categoryId = await resolveCategoryId(data.category_id)
      if (categoryId === null) return
      const fuelTypeId = await resolveFuelTypeId(data.fuel_type)
      if (fuelTypeId === null) return
      const vehicleType = await resolveVehicleType(data.vehicle_type)
      if (vehicleType === null) return

      const vehicleData = {
        ...data,
        ww_plate: data.ww_plate?.trim() || null,
        vehicle_type: vehicleType.name,
        type_id: vehicleType.id,
        category_id: Number(categoryId),
        fuel_type_id: fuelTypeId,
        purchase_date: data.purchase_date || null,
        puissance_fiscale: data.puissance_fiscale ? Number(data.puissance_fiscale) : null,
        ptac: data.ptac ? Number(data.ptac) : null,
      }

      await vehiclesApi.update(vehicle.id, vehicleData)
      showToast(t('vehicles.vehicleUpdated'), 'success')
      onSuccess?.()
      onClose()
    } catch (error) {
      showToast(error.message || t('vehicles.failedToSave'), 'error')
      console.error('Error saving vehicle:', error)
    } finally {
      setLoading(false)
    }
  })

  const close = () => {
    if (loading) return
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="lg"
      scrollable
      title={t('vehicles.editVehicle')}
      description={vehicle?.registration_plate || ''}
      footer={
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} loading={loading}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      {!ready ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-primary" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6" noValidate>
          <VehicleInfoFields
            t={t}
            register={register}
            control={control}
            errors={errors}
            existingTypes={existingTypes}
            existingBrands={existingBrands}
            existingCategories={categories.map((c) => c.name)}
            existingFuelTypes={fuelTypes.map((f) => f.name)}
            codeDisabled
          />
        </form>
      )}
    </Modal>
  )
}