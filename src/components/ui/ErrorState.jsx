import { useTranslation } from 'react-i18next'
import { AlertTriangle, RefreshCw01 } from '@untitledui/icons'
import Button from './Button'

const SF = { strokeWidth: 1.75, fill: 'none' }

export default function ErrorState({
  title,
  description,
  onRetry,
  retryText,
  icon: Icon = AlertTriangle,
}) {
  const { t } = useTranslation()

  const displayTitle = title || t('ui.errorTitle')
  const displayRetry = retryText || t('ui.retry')

  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-muted-foreground">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <Icon {...SF} className="h-10 w-10 text-destructive" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-foreground">{displayTitle}</h3>
      {description && (
        <p className="mb-5 text-center text-sm text-muted-foreground">{description}</p>
      )}
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
        >
          <RefreshCw01 {...SF} className="h-4 w-4 mr-1.5" />
          {displayRetry}
        </Button>
      )}
    </div>
  )
}