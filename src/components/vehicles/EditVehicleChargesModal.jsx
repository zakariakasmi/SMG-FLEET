import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { chargesApi, chargeTypesApi } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useYear } from '../../context/YearContext'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import ChargeAmountFields from './ChargeAmountFields'

export default function EditVehicleChargesModal({ isOpen, onClose, vehicle, onSuccess }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [chargeTypes, setChargeTypes] = useState([])
  const [values, setValues] = useState({})
  const { selectedYear } = useYear()

  useEffect(() => {
    if (isOpen && vehicle) {
      loadData()
    }
  }, [isOpen, vehicle])

  const loadData = async () => {
    try {
      const [types, existing] = await Promise.all([
        chargeTypesApi.list(),
        chargesApi.list({ vehicleId: vehicle.id, year: selectedYear }),
      ])
      setChargeTypes(types || [])
      const map = {}
      ;(existing || []).forEach((c) => {
        map[String(c.charge_type_id)] = c.amount?.toString() || ''
      })
      setValues(map)
    } catch (error) {
      console.error('Error loading charge data:', error)
    }
  }

  const handleValueChange = (id, value) => {
    setValues((prev) => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const rows = chargeTypes
        .filter((ct) => {
          const raw = (values[String(ct.id)] || '').trim()
          return raw !== '' && Number(raw) > 0
        })
        .map((ct) => ({
          vehicle_id: Number(vehicle.id),
          charge_type_id: Number(ct.id),
          amount: Number(values[String(ct.id)]),
          year: selectedYear,
        }))

      if (rows.length > 0) {
        await chargesApi.upsertBatch(rows)
      }
      showToast(t('charges.chargeUpdated'), 'success')
      onClose()
      if (onSuccess) onSuccess()
    } catch (error) {
      showToast(error.message || t('charges.failedToUpdate'), 'error')
      console.error('Error updating charges:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('charges.editCharge')} size="lg" scrollable>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <p className="text-sm mb-1 text-muted-foreground">{t('charges.vehicle')}</p>
          <p className="text-lg font-semibold text-foreground">
            {vehicle?.code}
            {vehicle?.registration_plate ? ` - ${vehicle.registration_plate}` : ''}
          </p>
        </div>

        <ChargeAmountFields
          chargeTypes={chargeTypes}
          values={values}
          onValueChange={handleValueChange}
        />

        <p className="text-sm text-muted-foreground">
          {t('charges.editChargesHint')}
        </p>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={loading}>
            {t('common.save')}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}