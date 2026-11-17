import { useTranslation } from 'react-i18next'
import { Menu01, Globe01, Sun, Moon01 } from '@untitledui/icons'
import { useTheme } from '../../context/ThemeContext'
import { useYear } from '../../context/YearContext'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from './NotificationBell'

const SF_PROPS = { strokeWidth: 1.75, fill: 'none' }

export default function Header({ onMenuClick }) {
  const { t, i18n } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const { selectedYear, setYear, availableYears } = useYear()
  const { can } = useAuth()
  const isDark = theme === 'dark'
  const canViewCharges = can('charges')

  const yearOptions =
    selectedYear && !availableYears.includes(selectedYear)
      ? [selectedYear, ...availableYears]
      : availableYears

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'fr' : 'en'
    i18n.changeLanguage(newLang)
    localStorage.setItem('smg-lang', newLang)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <button
          onClick={onMenuClick}
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          aria-label={t('common.menu')}
        >
          <Menu01 {...SF_PROPS} className="h-6 w-6" />
        </button>

        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-foreground">{t('login.fleetManager')}</p>
            <p className="text-xs text-muted-foreground">SMG Fleet</p>
          </div>

          <NotificationBell />

          <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
            {canViewCharges && (
              <>
                <select
                  value={selectedYear}
                  onChange={(e) => setYear(Number(e.target.value))}
                  aria-label={t('sidebar.year')}
                  className="flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>

                <div className="h-5 w-px bg-border" />
              </>
            )}

            <button
              onClick={toggleLanguage}
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label={t('sidebar.language')}
            >
              <Globe01 {...SF_PROPS} className="h-4 w-4" />
              {i18n.language.toUpperCase()}
            </button>

            <div className="h-5 w-px bg-border" />

            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label={t('sidebar.theme')}
            >
              {isDark ? <Sun {...SF_PROPS} className="h-4 w-4" /> : <Moon01 {...SF_PROPS} className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}