import { forwardRef } from 'react'
import { Loading02 } from '@untitledui/icons'

const SF = { strokeWidth: 1.75, fill: 'none' }

const Button = forwardRef(function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  ...props
}, ref) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-semibold rounded-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/85 shadow-sm',
    secondary: 'bg-secondary text-secondary-foreground border border-border hover:bg-secondary/70 shadow-sm',
    success: 'bg-success text-success-foreground hover:bg-success/90 shadow-sm',
    warning: 'bg-warning text-warning-foreground hover:bg-warning/90 shadow-sm',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
    dangerOutline: 'border border-destructive/40 bg-background text-destructive hover:bg-destructive/10 shadow-sm',
    ghost: 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
    outline: 'border border-border bg-background text-foreground hover:bg-muted shadow-sm',
    lime: 'bg-primary text-primary-foreground hover:bg-primary/85 shadow-sm',
  }

  const sizes = {
    sm: 'px-4 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-[15px]',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading && <Loading02 {...SF} className="animate-spin -ml-1 h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  )
})

export default Button