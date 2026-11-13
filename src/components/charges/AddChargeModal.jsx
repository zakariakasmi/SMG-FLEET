import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { chargesApi, chargeTypesApi } from '../../services/api'
import { chargeSchema } from '../../utils/validation'
import { useToast } from '../../context/ToastContext'
import { useYear } from '../../context/YearContext'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Modal from '../ui/Modal'

export default function AddChargeModal({ isOpen, onClose, vehicle, onSuccess }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { selectedYear } = useYear()
  const [loading, setLoading] = useState(false)
  const [chargeTypes, setChargeTypes] = useState([])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(chargeSchema),
    defaultValues: {
      vehicle_id: vehicle?.id || '',
      charge_type_id: '',
      amount: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (isOpen) {
      loadChargeTypes()
      reset({
        vehicle_id: vehicle?.id || '',
        charge_type_id: '',
        amount: '',
        notes: '',
      })
    }
  }, [isOpen, vehicle])

  const loadChargeTypes = async () => {
    try {
      const data = await chargeTypesApi.list()
      setChargeTypes(data || [])
    } catch (error) {
      console.error('Error loading charge types:', error)
    }
  }

  const onSubmit = async (data) => {
    try {
      setLoading(true)

      const chargeData = {
        vehicle_id: Number(vehicle.id),
        charge_type_id: Number(data.charge_type_id),
        amount: Number(data.amount),
        notes: data.notes || '',
        year: selectedYear,
      }

      await chargesApi.create(chargeData)
      showToast(t('charges.chargeAdded'), 'success')
      reset()
      onClose()
      if (onSuccess) onSuccess()
    } catch (error) {
      showToast(error.message || t('charges.failedToAdd'), 'error')
      console.error('Error adding charge:', error)
    } finally {
      setLoading(false)
    }
  }

  const chargeTypeOptions = chargeTypes.map((ct) => ({
    value: ct.id.toString(),
    label: ct.display_name,
  }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('charges.addCharge')}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Vehicle Info (Read-only) */}
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-sm mb-1 text-muted-foreground">{t('charges.vehicle')}</p>
          <p className="font-medium text-foreground">
            {vehicle?.code} - {vehicle?.registration_plate}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select
            label={t('charges.chargeType')}
            options={chargeTypeOptions}
            required
            error={errors.charge_type_id?.message}
            {...register('charge_type_id')}
          />

          <Input
            label={t('charges.amountMAD')}
            type="number"
            step="0.01"
            placeholder="0.00"
            required
            error={errors.amount?.message}
            {...register('amount')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            {t('common.notes')}
          </label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 border rounded-md shadow-sm bg-input border-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-ring"
            placeholder={t('common.optionalNotes')}
            {...register('notes')}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={loading}>
            {t('charges.addCharge')}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
