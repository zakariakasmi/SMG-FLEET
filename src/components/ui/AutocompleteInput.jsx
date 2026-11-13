import { useState, useEffect, useRef } from 'react'
import { ChevronDown, XClose } from '@untitledui/icons'

/**
 * AutocompleteInput - allows manual entry with autocomplete suggestions
 */
export default function AutocompleteInput({
  label,
  options = [],
  value,
  onChange,
  onKeyDown,
  placeholder = 'Type or select...',
  error,
  required = false,
  className = '',
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [filteredOptions, setFilteredOptions] = useState([])
  const [inputValue, setInputValue] = useState(value || '')
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (value !== undefined && value !== inputValue) {
      setInputValue(value)
    }
  }, [value])

  useEffect(() => {
    if (!inputValue) {
      setFilteredOptions(options.slice(0, 10))
    } else {
      const filtered = options.filter(opt =>
        opt.toLowerCase().includes(inputValue.toLowerCase())
      ).slice(0, 10)
      setFilteredOptions(filtered)
    }
  }, [inputValue, options])

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange?.(newValue)
    setShowDropdown(true)
  }

  const handleSelect = (option) => {
    setInputValue(option)
    onChange?.(option)
    setShowDropdown(false)
  }

  const handleClear = () => {
    setInputValue('')
    onChange?.('')
  }

  return (
    <div className="w-full" ref={wrapperRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-muted-foreground">
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          className={`
            w-full rounded-md border bg-background px-3 py-2 pr-8 text-[15px] text-foreground shadow-sm transition-all
            placeholder:text-muted-foreground/60
            focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40
            ${error ? 'border-destructive focus:border-destructive focus:ring-destructive/30' : 'border-border'}
            ${className}
          `}
        />

        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear"
          >
            <XClose className="h-4 w-4" />
          </button>
        )}

        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
          <ChevronDown className="h-4 w-4" />
        </div>

        {showDropdown && filteredOptions.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-popover shadow-md">
            {filteredOptions.map((option, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(option)}
                className="w-full px-4 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-muted"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}