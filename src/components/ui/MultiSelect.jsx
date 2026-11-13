import { useState, useRef, useEffect, forwardRef } from 'react'
import { CheckSquare, Square, ChevronDown, XClose } from '@untitledui/icons'

const SF = { strokeWidth: 1.75, fill: 'none' }

const MultiSelect = forwardRef(({
  label,
  options = [],
  value = [],
  onChange,
  placeholder = 'Select options',
  allLabel = 'All',
  showAll = true,
  error,
  required = false,
  className = '',
  ...props
}, ref) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isAllSelected = options.length > 0 && value.length === options.length
  const hasSelection = value.length > 0

  const handleToggle = (val) => {
    const next = value.includes(val) ? value.filter((v) => v !== val) : [...value, val]
    onChange?.(next)
  }

  const handleToggleAll = () => {
    if (isAllSelected) {
      onChange?.([])
    } else {
      onChange?.(options.map((o) => o.value))
    }
  }

  const display = () => {
    if (!hasSelection) return placeholder
    if (isAllSelected) return allLabel
    if (value.length === 1) return options.find((o) => o.value === value[0])?.label || value[0]
    return `${value.length} selected`
  }

  return (
    <div className={`w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="mb-2 block text-[13px] font-medium text-muted-foreground">
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex w-full items-center justify-between rounded-md border bg-background px-3.5 py-2.5 text-[15px] text-foreground shadow-sm transition-all focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 ${error ? 'border-destructive focus:border-destructive focus:ring-destructive/30' : 'border-border'}`}
          {...props}
        >
          <span className={hasSelection ? 'text-foreground' : 'text-muted-foreground'}>{display()}</span>
          <ChevronDown {...SF} className="h-4 w-4 text-muted-foreground" />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
            {showAll && options.length > 0 && (
              <button
                type="button"
                onClick={handleToggleAll}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left hover:bg-muted"
              >
                <span className={isAllSelected ? 'text-primary' : 'text-muted-foreground'}>
                  {isAllSelected ? <CheckSquare {...SF} className="h-4 w-4" /> : <Square {...SF} className="h-4 w-4" />}
                </span>
                <span className="text-[13px] font-medium text-foreground">{allLabel}</span>
              </button>
            )}
            <div className="max-h-60 overflow-y-auto">
              {options.map((o) => {
                const selected = value.includes(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => handleToggle(o.value)}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left hover:bg-muted"
                  >
                    <span className={selected ? 'text-primary' : 'text-muted-foreground'}>
                      {selected ? <CheckSquare {...SF} className="h-4 w-4" /> : <Square {...SF} className="h-4 w-4" />}
                    </span>
                    <span className="text-[13px] font-medium text-foreground">{o.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {hasSelection && (
          <button
            type="button"
            onClick={() => onChange?.([])}
            className="absolute right-7 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <XClose {...SF} className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  )
})

MultiSelect.displayName = 'MultiSelect'
export default MultiSelect