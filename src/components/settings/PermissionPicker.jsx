import { useTranslation } from 'react-i18next'
import { PERMISSION_GROUPS, PERMISSION_LABELS } from '../../constants/permissions'

// A permission is one row, and the whole row is the control: a single
// <button role="switch">. Nothing is nested, so clicking the label, the track
// or the knob all toggle it, and it is reachable with Tab + Space.
function PermissionRow({ label, checked, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        checked
          ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
          : 'border-border bg-background hover:bg-muted/60'
      }`}
    >
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-foreground">{label}</span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-input'
        }`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`}
        />
      </span>
    </button>
  )
}

// Every scope is rendered, grouped, with a per-group counter so it is obvious
// at a glance what is granted. `value` is the list of granted scope keys.
export default function PermissionPicker({ value, onToggle, className }) {
  const { t } = useTranslation()
  const granted = new Set(Array.isArray(value) ? value : [])

  return (
    <div className={`grid gap-3 ${className || 'sm:grid-cols-2'}`}>
      {PERMISSION_GROUPS.map((group) => {
        const count = group.keys.filter((key) => granted.has(key)).length
        return (
          <div key={group.labelKey} className="rounded-xl border border-border bg-card/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(group.labelKey)}
              </span>
              <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                {count}/{group.keys.length}
              </span>
            </div>
            <div className="grid gap-1.5">
              {group.keys.map((key) => (
                <PermissionRow
                  key={key}
                  label={t(PERMISSION_LABELS[key])}
                  checked={granted.has(key)}
                  onToggle={() => onToggle(key)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
