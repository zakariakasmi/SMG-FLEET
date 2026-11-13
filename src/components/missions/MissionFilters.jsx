import { useTranslation } from 'react-i18next'
import { Shield01, XClose } from '@untitledui/icons'
import Input from '../ui/Input'
import Button from '../ui/Button'

const SF = { strokeWidth: 1.75, fill: 'none' }

function Toggle({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-all ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Filter bar for the Missions list. Values live in the URL (owned by
 * MissionsList) so the view is deep-linkable; this component is presentational.
 */
export default function MissionFilters({ filters, onChange, onReset, resultCount, rangeLabel }) {
  const { t } = useTranslation()
  const hasActive =
    Boolean(filters.search || filters.from || filters.to || filters.vehicle || filters.driver) ||
    filters.gendarmerie || filters.needsReview || filters.unknownVehicle

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder={t('missions.searchPlaceholder')}
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
        <Input
          type="date"
          label={t('missions.from')}
          value={filters.from}
          onChange={(e) => onChange({ from: e.target.value })}
        />
        <Input
          type="date"
          label={t('missions.to')}
          value={filters.to}
          onChange={(e) => onChange({ to: e.target.value })}
        />
        <div className="flex items-end">
          <Input
            placeholder={t('missions.vehiclePlaceholder')}
            value={filters.vehicle}
            onChange={(e) => onChange({ vehicle: e.target.value })}
          />
        </div>
        <Input
          placeholder={t('missions.driverPlaceholder')}
          value={filters.driver}
          onChange={(e) => onChange({ driver: e.target.value })}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Toggle active={filters.gendarmerie} onClick={() => onChange({ gendarmerie: !filters.gendarmerie })}>
          <Shield01 {...SF} className="h-3.5 w-3.5" />
          {t('missions.gendarmerieRequired')}
        </Toggle>
        <Toggle active={filters.needsReview} onClick={() => onChange({ needsReview: !filters.needsReview })}>
          {t('missions.filterNeedsReview')}
        </Toggle>
        <Toggle active={filters.unknownVehicle} onClick={() => onChange({ unknownVehicle: !filters.unknownVehicle })}>
          {t('missions.filterUnknownVehicle')}
        </Toggle>

        <span className="ml-auto text-[13px] font-medium text-muted-foreground">
          {resultCount} {t('missions.results')}
          {rangeLabel && (
            <span className="ml-1.5 font-normal text-muted-foreground/70">· {rangeLabel}</span>
          )}
        </span>
        {hasActive && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <XClose {...SF} className="h-4 w-4 mr-1.5" />
            {t('missions.clearFilters')}
          </Button>
        )}
      </div>
    </div>
  )
}
