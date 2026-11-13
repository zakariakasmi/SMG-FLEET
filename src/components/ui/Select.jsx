import { forwardRef } from 'react'

const Select = forwardRef(({
  label,
  options = [],
  error,
  required = false,
  placeholder = 'Select an option',
  showAll = false,
  allLabel = 'All',
  className = '',
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-[13px] font-medium text-muted-foreground">
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </label>
      )}
      <select
        ref={ref}
        className={`
          w-full appearance-none rounded-md border bg-background px-3.5 py-2.5 text-[15px] text-foreground shadow-sm transition-all
          focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40
          disabled:cursor-not-allowed disabled:opacity-60
          bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-[right_0.75rem_center] bg-no-repeat pr-9
          ${error ? 'border-destructive focus:border-destructive focus:ring-destructive/30' : 'border-border'}
          ${className}
        `}
        {...props}
      >
        <option value="" disabled className="text-muted-foreground">
          {placeholder}
        </option>
        {showAll && (
          <option value="">{allLabel}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
})

Select.displayName = 'Select'

export default Select