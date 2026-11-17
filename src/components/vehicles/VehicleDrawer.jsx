import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { XClose, Truck01 as Truck } from '@untitledui/icons'
import { vehiclesApi, chargesApi } from '../../services/api'
import {
  formatCurrency,
  getStatusBadge,
  getVehicleTypeLabel,
  getFuelTypeLabel,
} from '../../utils/formatters'
import {
  getChargeName,
  vehicleAnnualTotal,
  vehicleMonthlyTotal,
} from '../../utils/calculations'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useYear } from '../../context/YearContext'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import EditVehicleModal from './EditVehicleModal'
import EditVehicleChargesModal from './EditVehicleChargesModal'

const SF = { strokeWidth: 1.75, fill: 'none' }

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[14px] font-medium text-foreground truncate">
        {value}
      </p>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h4 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  )
}

export default function VehicleDrawer({ vehicle, isOpen, onClose, onChanged }) {
  const { t } = useTranslation()
  const { can } = useAuth()
  const { showToast } = useToast()
  const { selectedYear } = useYear()

  const canViewCharges = can('charges')
  const [fullVehicle, setFullVehicle] = useState(null)
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(false)
  const [editChargesOpen, setEditChargesOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (!isOpen || !vehicle) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [v, c] = await Promise.all([
          vehiclesApi.getByCode(vehicle.code),
          canViewCharges
            ? chargesApi.list({ vehicleId: vehicle.id, year: selectedYear })
            : Promise.resolve([]),
        ])
        if (cancelled) return
        setFullVehicle(v)
        setCharges(c || [])
      } catch (error) {
        if (!cancelled) {
          showToast(t('vehicles.failedToLoadVehicle'), 'error')
          console.error('Error loading vehicle:', error)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isOpen, vehicle, selectedYear, canViewCharges])

  const detailVehicle = fullVehicle || vehicle
  const statusBadge = detailVehicle ? getStatusBadge(detailVehicle.status) : null
  const totalCharges = charges.length ? vehicleAnnualTotal(charges) : 0
  const monthly = charges.length ? vehicleMonthlyTotal(detailVehicle, charges) : 0

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        hideHeader
        scrollable
        bodyCls="px-6 pt-6 pb-3"
        footerCls="px-6 py-5"
        footer={
          <div className="flex w-full flex-col-reverse gap-3 sm:flex-row">
            {can('editVehicles') && (
              <Button
                variant="secondary"
                className="sm:flex-1"
                onClick={() => setEditOpen(true)}
              >
                {t('vehicles.editVehicle')}
              </Button>
            )}
            {can('editCharges') && (
              <Button className="sm:flex-1" onClick={() => setEditChargesOpen(true)}>
                {t('vehicles.editCharges')}
              </Button>
            )}
          </div>
        }
      >
        {loading && !detailVehicle ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-primary" />
          </div>
        ) : (
          detailVehicle && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Truck {...SF} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold leading-tight text-foreground">
                        {detailVehicle.code}
                      </h3>
                      {statusBadge && (
                        <span
                          className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${statusBadge.className}`}
                        >
                          {statusBadge.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {detailVehicle.registration_plate || ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="ml-2 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <XClose {...SF} className="h-5 w-5" />
                </button>
              </div>

              <section>
                <SectionTitle>{t('vehicles.sectionDetails')}</SectionTitle>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-border bg-card p-5">
                  <Field
                    label={t('vehicles.regPlate')}
                    value={detailVehicle.registration_plate || '-'}
                  />
                  <Field
                    label={t('vehicles.wwPlate')}
                    value={detailVehicle.ww_plate || '-'}
                  />
                  <Field
                    label={t('vehicles.chassisNumber')}
                    value={detailVehicle.chassis_number || '-'}
                  />
                  <Field
                    label={t('vehicles.vehicleType')}
                    value={getVehicleTypeLabel(detailVehicle.vehicle_type)}
                  />
                  <Field
                    label={t('vehicles.brand')}
                    value={detailVehicle.brand || '-'}
                  />
                  <Field
                    label={t('vehicles.category')}
                    value={detailVehicle.category?.name || '-'}
                  />
                  <Field
                    label={t('vehicles.fuelType')}
                    value={getFuelTypeLabel(detailVehicle.fuel_type) || '-'}
                  />
                  <Field
                    label={t('vehicles.puissanceFiscale')}
                    value={
                      detailVehicle.puissance_fiscale
                        ? Number(detailVehicle.puissance_fiscale).toString()
                        : '-'
                    }
                  />
                  <Field
                    label={t('vehicles.ptac')}
                    value={
                      detailVehicle.ptac
                        ? Number(detailVehicle.ptac).toString()
                        : '-'
                    }
                  />
                </div>
              </section>

              {canViewCharges && (
                <>
                  <section>
                    <SectionTitle>{t('vehicles.charges')}</SectionTitle>
                    {charges.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t('vehicles.noChargesYet')}
                      </p>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {charges
                          .slice()
                          .sort((a, b) => Number(a.amount) - Number(b.amount))
                          .map((c, i) => (
                            <div
                              key={c.id}
                              className={`flex items-center justify-between px-4 py-2.5 ${
                                i < charges.length - 1 ? 'border-b border-border' : ''
                              }`}
                            >
                              <span className="text-[14px] text-foreground">
                                {getChargeName(c)}
                              </span>
                              <span className="text-[14px] font-medium text-foreground">
                                {formatCurrency(Number(c.amount))}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </section>

                  <section>
                    <SectionTitle>{t('vehicles.sectionFinancial')}</SectionTitle>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border border-border bg-muted/40 p-4">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {t('vehicles.totalCharges')}
                        </p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                          {formatCurrency(totalCharges)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/40 p-4">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {t('dashboard.monthlyCharges')}
                        </p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                          {formatCurrency(monthly)}
                          <span className="text-[13px] font-medium text-muted-foreground">
                            {t('common.perMonthSuffix')}
                          </span>
                        </p>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </div>
          )
        )}
      </Modal>

      {canViewCharges && can('editCharges') && (
        <EditVehicleChargesModal
          isOpen={editChargesOpen}
          onClose={() => setEditChargesOpen(false)}
          vehicle={detailVehicle}
          onSuccess={() => {
            setEditChargesOpen(false)
            loadFresh()
          }}
        />
      )}

      <EditVehicleModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        vehicle={detailVehicle}
        onSuccess={() => {
          loadFresh()
          onChanged?.()
        }}
      />
    </>
  )

  async function loadFresh() {
    if (!vehicle) return
    try {
      const [v, c] = await Promise.all([
        vehiclesApi.getByCode(vehicle.code),
        canViewCharges
          ? chargesApi.list({ vehicleId: vehicle.id, year: selectedYear })
          : Promise.resolve([]),
      ])
      setFullVehicle(v)
      setCharges(c || [])
    } catch (error) {
      console.error('Error reloading vehicle:', error)
    }
  }
}