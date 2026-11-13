import { forwardRef } from 'react'

const Input = forwardRef(({
  label,
  type = 'text',
  error,
  required = false,
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
      <input
        ref={ref}
        type={type}
        className={`
          w-full rounded-md border bg-background px-3.5 py-2.5 text-[15px] text-foreground shadow-sm transition-all
          placeholder:text-muted-foreground/60
          focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40
          disabled:cursor-not-allowed disabled:opacity-60
          ${error ? 'border-destructive focus:border-destructive focus:ring-destructive/30' : 'border-border'}
          ${className}
        `}
        placeholder={props.placeholder}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input