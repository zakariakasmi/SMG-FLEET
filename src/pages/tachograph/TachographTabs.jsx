import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'

// The tachograph module has no global navbar: these two tabs sit at the top of
// each page so operations and their demand forms stay one click apart.
// A requester only has the demand book, so the operations tab is not rendered
// for them at all — and with a single tab left there is no tab bar to show.
const tabs = [
  { to: '/tachograph', labelKey: 'tachograph.operationsTitle', end: true, scope: 'tachograph' },
  { to: '/tachograph/demandes', labelKey: 'tachograph.demandsTitle' },
]

export default function TachographTabs() {
  const { t } = useTranslation()
  const { can } = useAuth()

  const visible = tabs.filter((tab) => !tab.scope || can(tab.scope))
  if (visible.length < 2) return null

  return (
    <div
      role="tablist"
      className="inline-flex w-full max-w-md rounded-lg border border-border bg-muted/40 p-1 sm:w-auto"
    >
      {visible.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          role="tab"
          className={({ isActive }) =>
            `flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-center text-[13px] font-semibold transition-colors sm:flex-none ${
              isActive
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          {t(tab.labelKey)}
        </NavLink>
      ))}
    </div>
  )
}
