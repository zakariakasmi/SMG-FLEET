import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Edit01 as Edit, Trash01 as Trash2, Plus, ArrowLeft, Truck01 as Truck, Clock } from '@untitledui/icons'
import { vehiclesApi, chargesApi } from '../../services/api'
import { formatDate, formatNumber, formatCurrency, getStatusBadge, getVehicleTypeLabel } from '../../utils/formatters'
import { vehicleAnnualTotal, vehicleMonthlyTotal } from '../../utils/calculations'
import { useToast } from '../../context/ToastContext'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import Skeleton from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { ConfirmModal } from '../../components/ui/Modal'
import AddChargeModal from '../../components/charges/AddChargeModal'
import EditChargeModal from '../../components/charges/EditChargeModal'
import { useAuth } from '../../context/AuthContext'
import { useYear } from '../../context/YearContext'

const SF = { strokeWidth: 1.75, fill: 'none' }

function InfoItem({ label, value, accent = false }) {
  return (
    <div>
      <p className="text-[13px] font-medium mb-1 text-muted-foreground">{label}</p>
      <p className={`text-[15px] font-medium ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  )
}

export default function VehicleDetail() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const { code } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { selectedYear } = useYear()

  const [vehicle, setVehicle] = useState(null)
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addChargeModalOpen, setAddChargeModalOpen] = useState(false)
  const [editChargeModalOpen, setEditChargeModalOpen] = useState(false)
  const [selectedCharge, setSelectedCharge] = useState(null)

  const canViewCharges = can('charges')

  useEffect(() => {
    loadVehicle()
  }, [code, selectedYear, canViewCharges])

  const loadVehicle = async () => {
    try {
      setLoading(true)
      setLoadError(false)
      const vehicleData = await vehiclesApi.getByCode(code)
      setVehicle(vehicleData)

      if (canViewCharges) {
        const chargesData = await chargesApi.list({ vehicleId: vehicleData.id, year: selectedYear })
        setCharges(chargesData || [])
      } else {
        setCharges([])
      }
    } catch (error) {
      console.error('Error loading vehicle:', error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await vehiclesApi.delete(vehicle.id)
      showToast(t('vehicles.vehicleDeleted'), 'success')
      navigate('/vehicles')
    } catch (error) {
      showToast(t('vehicles.failedToDelete'), 'error')
      console.error('Error deleting vehicle:', error)
    } finally {
      setDeleting(false)
      setDeleteModal(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft {...SF} className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
        </div>
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </Card>
        <Card padding={false}>
          <div className="p-6">
            <Skeleton className="h-6 w-40 mb-6" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (loadError) {
    return (
      <ErrorState
        title={t('vehicles.failedToLoadVehicle')}
        description={t('ui.errorLoadDesc')}
        onRetry={loadVehicle}
      />
    )
  }

  if (!vehicle) {
    return (
      <EmptyState
        title={t('vehicles.vehicleNotFound')}
        description={t('vehicles.vehicleNotFoundDesc')}
        action={<Button onClick={() => navigate('/vehicles')}>{t('vehicles.backToVehicles')}</Button>}
      />
    )
  }

  const statusBadge = getStatusBadge(vehicle.status)

  const annualTotal = charges.length ? vehicleAnnualTotal(charges) : 0
  const monthlyTotal = charges.length ? vehicleMonthlyTotal(vehicle, charges) : 0

  const chargeColumns = [
    {
      key: 'charge_type',
      label: t('vehicles.chargeType'),
      render: (row) => row.charge_type?.display_name || '-',
    },
    {
      key: 'amount',
      label: t('vehicles.amount'),
      render: (row) => formatCurrency(row.amount),
    },
  ]

  const totalCharges = charges.reduce((sum, c) => sum + Number(c.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <ArrowLeft {...SF} className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>
      </div>

      {/* Vehicle Info */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center bg-primary/10 text-primary"
            >
              <Truck {...SF} className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-foreground">{vehicle.code}</h1>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusBadge.className}`}>
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{vehicle.registration_plate}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {can('addTachograph') && (
              <Button
                variant="secondary"
                onClick={() => navigate(`/tachograph?new=1&vehicle=${vehicle.id}`)}
              >
                <Clock {...SF} className="w-4 h-4 mr-2" />
                {t('tachograph.logRevision')}
              </Button>
            )}
            {can('editVehicles') && (
              <Button variant="secondary" onClick={() => navigate(`/vehicles/${vehicle.code}/edit`)}>
                <Edit {...SF} className="w-4 h-4 mr-2" />
                {t('common.update')}
              </Button>
            )}
            {can('deleteVehicles') && (
              <Button variant="danger" onClick={() => setDeleteModal(true)}>
                <Trash2 {...SF} className="w-4 h-4 mr-2" />
                {t('common.delete')}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <InfoItem label={t('vehicles.vehicleType')} value={getVehicleTypeLabel(vehicle.vehicle_type)} />
          <InfoItem label={t('vehicles.brand')} value={vehicle.brand || '-'} />
          <InfoItem label={t('vehicles.fuelType')} value={vehicle.fuel_type || '-'} />
          <InfoItem label={t('vehicles.category')} value={vehicle.category?.name || '-'} />
          <InfoItem label={t('vehicles.wwPlate')} value={vehicle.ww_plate || '-'} />
          <InfoItem label={t('vehicles.puissanceFiscale')} value={vehicle.puissance_fiscale ? formatNumber(vehicle.puissance_fiscale) : '-'} />
          <InfoItem label={t('vehicles.ptac')} value={vehicle.ptac ? formatNumber(vehicle.ptac) : '-'} />
          <InfoItem label={t('vehicles.purchaseDate')} value={formatDate(vehicle.purchase_date)} />
          {canViewCharges && (
            <InfoItem label={t('vehicles.totalCharges')} value={formatCurrency(totalCharges)} accent />
          )}
        </div>

        {vehicle.notes && (
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm font-medium mb-1 text-muted-foreground">{t('common.notes')}</p>
            <p className="text-foreground">{vehicle.notes}</p>
          </div>
        )}
      </Card>

      {canViewCharges && (
        <>
          {/* Annual / Monthly Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg p-5 border border-border bg-card">
              <p className="text-[13px] font-medium text-muted-foreground">{t('vehicles.totalCharges')}</p>
              <p className="text-3xl font-semibold mt-1 text-foreground">{formatCurrency(annualTotal)}</p>
            </div>
            <div className="rounded-lg p-5 border border-primary/20 bg-primary/10">
              <p className="text-[13px] font-medium text-muted-foreground">{t('dashboard.monthlyCharges')}</p>
              <p className="text-3xl font-semibold mt-1 text-foreground">{formatCurrency(monthlyTotal)}</p>
            </div>
          </div>

          {/* Charges */}
          <Card padding={false}>
            <div className="p-6 flex items-center justify-between border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">{t('vehicles.charges')}</h2>
              {can('addCharges') && (
                <Button onClick={() => setAddChargeModalOpen(true)}>
                  <Plus {...SF} className="w-4 h-4 mr-2" />
                  {t('vehicles.addCharge')}
                </Button>
              )}
            </div>

            {charges.length === 0 ? (
              <EmptyState
                title={t('vehicles.noChargesYet')}
                description={t('vehicles.noChargesDesc')}
                action={
                  can('addCharges') ? (
                    <Button onClick={() => setAddChargeModalOpen(true)}>
                      {t('vehicles.addFirstCharge')}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <Table
                columns={chargeColumns}
                data={charges}
                onRowClick={can('editCharges') ? (row) => {
                  setSelectedCharge(row)
                  setEditChargeModalOpen(true)
                } : undefined}
              />
            )}
          </Card>
        </>
      )}

      <ConfirmModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleDelete}
        title={t('vehicles.deleteVehicle')}
        message={t('vehicles.deleteVehicleConfirm', { code })}
        confirmText={t('common.delete')}
        loading={deleting}
      />

      {canViewCharges && (
        <>
          <AddChargeModal
            isOpen={addChargeModalOpen}
            onClose={() => setAddChargeModalOpen(false)}
            vehicle={vehicle}
            onSuccess={loadVehicle}
          />

          <EditChargeModal
            isOpen={editChargeModalOpen}
            onClose={() => {
              setEditChargeModalOpen(false)
              setSelectedCharge(null)
            }}
            charge={selectedCharge}
            onSuccess={loadVehicle}
          />
        </>
      )}
    </div>
  )
}