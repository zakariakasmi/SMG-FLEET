import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutGrid01,
  Truck01,
  Clock,
  Download01,
  Upload01,
  XClose,
  LogOut01,
  Settings01,
} from '@untitledui/icons'
import { useAuth } from '../../context/AuthContext'
import { DEMAND_ACCESS_SCOPES } from '../../constants/permissions'

const SF_PROPS = { strokeWidth: 1.75, fill: 'none' }

export default function Sidebar({ isOpen, onClose }) {
  const { logout, user, can, isAdmin } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()

  const navItems = [
    { icon: LayoutGrid01, label: t('sidebar.dashboard'), path: '/' },
    { icon: Truck01, label: t('sidebar.vehicles'), path: '/vehicles', scope: 'vehicles' },
    { icon: Download01, label: t('sidebar.import'), path: '/import', scope: 'import' },
    { icon: Upload01, label: t('sidebar.export'), path: '/export', scope: 'export' },
    // Operations users land on the operations book; a requester only has the
    // demand book, so the same entry points them straight at their demands.
    {
      icon: Clock,
      label: t('sidebar.tachograph'),
      path: can('tachograph') ? '/tachograph' : '/tachograph/demandes',
      scopes: DEMAND_ACCESS_SCOPES,
    },
  ].filter((item) => (!item.scope || can(item.scope)) && (!item.scopes || item.scopes.some((s) => can(s))))

  const navLinkClass = (active) =>
    `flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-semibold transition-colors ${
      active
        ? 'bg-primary/10 text-primary hover:bg-primary/15'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    }`

  const isSettingsActive =
    location.pathname === '/settings' || location.pathname.startsWith('/settings/')

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out
          lg:static lg:z-0 lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5 text-[17px] font-semibold text-card-foreground">
            <img src="/logo.png" alt="SMG Fleet" className="h-7 w-7 rounded-md" />
            <span>SMG Fleet</span>
          </Link>
          <button
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <XClose {...SF_PROPS} className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            {t('sidebar.menu')}
          </p>
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={navLinkClass(isActive)}
                >
                  <Icon {...SF_PROPS} className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </div>

          {isAdmin && (
            <>
              <div className="my-3 h-px bg-border" />
              <Link
                to="/settings"
                onClick={onClose}
                className={navLinkClass(isSettingsActive)}
              >
                <Settings01 {...SF_PROPS} className="h-5 w-5" />
                {t('sidebar.settings')}
              </Link>
            </>
          )}
        </nav>

        <div className="space-y-1 border-t border-border p-3">
          {user && (
            <Link
              to="/settings/account"
              onClick={onClose}
              className="flex items-center gap-3 rounded-md bg-muted/60 px-3 py-2 transition-colors hover:bg-muted"
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-primary-foreground"
                style={{ background: 'hsl(var(--primary))' }}
              >
                {(user.display_name || user.username || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-foreground">
                  {user.display_name || user.username}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">
                  @{user.username}
                </p>
              </div>
            </Link>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md border border-destructive/30 px-3 py-2.5 text-[15px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut01 {...SF_PROPS} className="h-5 w-5" />
            {t('sidebar.logout')}
          </button>
        </div>
      </aside>
    </>
  )
}