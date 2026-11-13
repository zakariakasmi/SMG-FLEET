import { useTranslation } from 'react-i18next'
import { Inbox01 } from '@untitledui/icons'

export default function EmptyState({
  icon: Icon = Inbox01,
  title,
  description,
  action,
}) {
  const { t } = useTranslation()

  const displayTitle = title || t('ui.noData')

  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-muted-foreground">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-10 w-10 text-muted-foreground/60" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-foreground">
        {displayTitle}
      </h3>
      {description && (
        <p className="mb-4 text-center text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}