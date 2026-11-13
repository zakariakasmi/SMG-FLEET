import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { chargesApi, chargeTypesApi } from '../../services/api'
import { chargeSchema } from '../../utils/validation'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Modal, { ConfirmModal } from '../ui/Modal'

export default function EditChargeModal({ isOpen, onClose, charge, onSuccess }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { can } = useAuth()
  const [loading, setLoading] = useState(false)
  const [chargeTypes, setChargeTypes] = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(chargeSchema),
    defaultValues: {
      vehicle_id: '',
      charge_type_id: '',
      amount: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (isOpen && charge) {
      loadChargeTypes()
    }
  }, [isOpen, charge])

  useEffect(() => {
    if (isOpen && charge && chargeTypes.length > 0) {
      reset({
        vehicle_id: charge.vehicle_id,
        charge_type_id: charge.charge_type_id?.toString() || '',
        amount: charge.amount?.toString() || '',
        notes: charge.notes || '',
      })
    }
  }, [isOpen, charge, chargeTypes, reset])

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
        vehicle_id: Number(charge.vehicle_id),
        charge_type_id: Number(data.charge_type_id),
        amount: Number(data.amount),
        notes: data.notes || '',
      }

      await chargesApi.update(charge.id, chargeData)
      showToast(t('charges.chargeUpdated'), 'success')
      onClose()
      if (onSuccess) onSuccess()
    } catch (error) {
      showToast(error.message || t('charges.failedToUpdate'), 'error')
      console.error('Error updating charge:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setLoading(true)
      await chargesApi.delete(charge.id)
      showToast(t('charges.chargeDeleted'), 'success')
      setDeleteConfirm(false)
      onClose()
      if (onSuccess) onSuccess()
    } catch (error) {
      showToast(t('charges.failedToDelete'), 'error')
      console.error('Error deleting charge:', error)
    } finally {
      setLoading(false)
    }
  }

  const chargeTypeOptions = chargeTypes.map((ct) => ({
    value: ct.id.toString(),
    label: ct.display_name,
  }))

  if (!charge) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('charges.editCharge')}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Vehicle Info (Read-only) */}
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-sm mb-1 text-muted-foreground">{t('charges.vehicle')}</p>
          <p className="font-medium text-foreground">
            {charge.vehicle?.code} - {charge.vehicle?.registration_plate}
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

        <div className="flex items-center justify-between gap-3 pt-2">
          {can('deleteCharges') && (
            <Button
              type="button"
              variant="danger"
              onClick={() => setDeleteConfirm(true)}
              disabled={loading}
            >
              {t('common.delete')}
            </Button>
          )}
          <div className="flex gap-3 ml-auto">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading}>
              {t('charges.editCharge')}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmModal
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={t('charges.deleteCharge')}
        message={t('charges.deleteConfirm', {
          charge: charge?.charge_type?.display_name || t('charges.chargeType'),
        })}
        confirmText={t('common.delete')}
        loading={loading}
      />
    </Modal>
  )
}
