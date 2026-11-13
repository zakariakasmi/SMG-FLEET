export default function Card({ children, className = '', padding = true, hover = false, elevated = false }) {
  return (
    <div
      className={`
        rounded-xl border border-border bg-card text-card-foreground transition-all duration-300
        ${elevated ? 'shadow-md' : 'shadow-sm'}
        ${hover ? 'hover:shadow-md hover:border-border/80' : ''}
        ${padding ? 'p-6' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function StatCard({ title, value, icon, trend, trendValue }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="mb-1 text-sm text-muted-foreground">
            {title}
          </p>
          <p className="text-3xl text-foreground">
            {value}
          </p>
          {trend && (
            <div
              className={`mt-2 flex items-center text-sm ${trend === 'up' ? 'text-success' : 'text-destructive'}`}
            >
              {trend === 'up' ? '↑' : '↓'} {trendValue}
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 rounded-lg bg-muted p-3 text-primary">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}