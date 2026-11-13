import { useTranslation } from 'react-i18next'

export default function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-[3px]',
    lg: 'h-12 w-12 border-[3px]',
  }

  return (
    <div
      className={`animate-spin rounded-full border-primary border-b-transparent ${sizes[size]} ${className}`}
      aria-label="Loading"
      role="status"
    />
  )
}

export function PageSpinner({ message }) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">
        {message || t('common.loading')}
      </p>
    </div>
  )
}