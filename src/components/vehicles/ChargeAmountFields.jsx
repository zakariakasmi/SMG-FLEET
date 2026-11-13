import { useTranslation } from 'react-i18next'
import Input from '../ui/Input'

export default function ChargeAmountFields({ chargeTypes = [], values = {}, onValueChange, disabled = false }) {
  const { t } = useTranslation()

  if (chargeTypes.length === 0) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: '#575757' }}>
        {t('charges.noChargeTypes')}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {chargeTypes.map((ct) => (
        <Input
          key={ct.id}
          label={t(`chargeTypes.${ct.name}`, { defaultValue: ct.display_name })}
          type="number"
          step="0.01"
          placeholder="0.00"
          disabled={disabled}
          value={values[String(ct.id)] ?? ''}
          onChange={(e) => onValueChange(String(ct.id), e.target.value)}
        />
      ))}
    </div>
  )
}