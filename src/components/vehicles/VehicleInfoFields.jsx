import { Controller } from 'react-hook-form'
import Input from '../ui/Input'
import Select from '../ui/Select'
import AutocompleteInput from '../ui/AutocompleteInput'

export default function VehicleInfoFields({
  t,
  register,
  control,
  errors,
  existingTypes,
  existingBrands,
  existingCategories,
  existingFuelTypes,
  codeDisabled,
}) {
  const fuelTypeOptions = (existingFuelTypes || []).map((ft) => ({ value: ft, label: ft }))

  const statusOptions = [
    { value: 'active', label: t('common.active') },
    { value: 'sold', label: t('common.sold') },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Input
        label={t('vehicles.vehicleCode')}
        placeholder={t('vehicles.codeExample')}
        required
        error={errors.code?.message}
        {...register('code')}
        disabled={codeDisabled}
      />

      <Input
        label={t('vehicles.regPlate')}
        placeholder={t('vehicles.plateExample')}
        required
        error={errors.registration_plate?.message}
        {...register('registration_plate')}
      />

      <Input
        label={t('vehicles.wwPlate')}
        placeholder={t('vehicles.wwPlateExample')}
        error={errors.ww_plate?.message}
        {...register('ww_plate')}
      />

      <Controller
        name="vehicle_type"
        control={control}
        render={({ field }) => (
          <AutocompleteInput
            label={t('vehicles.vehicleType')}
            placeholder={t('vehicles.typeExample')}
            required
            error={errors.vehicle_type?.message}
            options={existingTypes}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        name="brand"
        control={control}
        render={({ field }) => (
          <AutocompleteInput
            label={t('vehicles.brand')}
            placeholder={t('vehicles.brandExample')}
            required
            error={errors.brand?.message}
            options={existingBrands}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <Select
        label={t('vehicles.fuelType')}
        options={fuelTypeOptions}
        required
        error={errors.fuel_type?.message}
        {...register('fuel_type')}
      />

      <Input
        label={t('vehicles.purchaseDate')}
        type="date"
        error={errors.purchase_date?.message}
        {...register('purchase_date')}
      />

      <Input
        label={t('vehicles.puissanceFiscale')}
        type="number"
        placeholder={t('vehicles.pfExample')}
        error={errors.puissance_fiscale?.message}
        {...register('puissance_fiscale')}
      />

      <Input
        label={t('vehicles.ptac')}
        type="number"
        placeholder={t('vehicles.ptacExample')}
        error={errors.ptac?.message}
        {...register('ptac')}
      />

      <Controller
        name="category_id"
        control={control}
        render={({ field }) => (
          <AutocompleteInput
            label={t('vehicles.category')}
            placeholder={t('vehicles.categoryExample')}
            required
            error={errors.category_id?.message}
            options={existingCategories}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <Select
        label={t('common.status')}
        options={statusOptions}
        required
        error={errors.status?.message}
        {...register('status')}
      />

      <div className="md:col-span-2">
        <label className="block text-[13px] font-medium mb-2 text-muted-foreground">
          {t('common.notes')}
        </label>
        <textarea
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-md border border-input bg-input text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
          placeholder={t('common.optionalNotes')}
          style={{ fontFamily: 'inherit' }}
          {...register('notes')}
        />
      </div>
    </div>
  )
}