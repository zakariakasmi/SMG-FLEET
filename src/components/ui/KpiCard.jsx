const SFProps = { strokeWidth: 1.75, fill: 'none' }

export default function KpiCard({ title, value, icon: Icon, iconClassName = '', className = '' }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-300 ${className}`}
    >
      <div className="min-w-0">
        <p className="mb-1.5 text-sm text-muted-foreground">
          {title}
        </p>
        <p className="text-[32px] font-semibold leading-none tracking-tight tabular-nums text-card-foreground">
          {value}
        </p>
      </div>
      {Icon && (
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}
        >
          <Icon {...SFProps} className="h-6 w-6" />
        </div>
      )}
    </div>
  )
}