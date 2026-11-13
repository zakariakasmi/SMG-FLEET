import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell01, BellOff01, ChevronRight, FileCheck01, Receipt } from '@untitledui/icons'
import { tachographApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { daysUntil } from '../../utils/tachograph'
import { formatCurrency, formatDate } from '../../utils/formatters'

const SF = { strokeWidth: 1.75, fill: 'none' }

// Header alerts for the tachograph module:
//   * new demands (En cours) waiting for the fleet manager;
//   * operations logged without a purchase order (BC).
export default function NotificationBell() {
  const { t } = useTranslation()
  const { can } = useAuth()
  // Operations users get the BC alerts; the fleet manager gets the new-demand
  // alerts even without the operations book. A plain requester gets neither:
  // they only see their own demands, so an alert would just echo their list.
  const canSeeOperations = can('tachograph')
  const canSeeAllDemands = can('viewAllTachographDemands')
  const allowed = canSeeOperations || canSeeAllDemands

  const [bcItems, setBcItems] = useState([])
  const [demands, setDemands] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const load = useCallback(
    async (silent = false) => {
      if (!allowed) return
      if (!silent) setLoading(true)
      try {
        // One failing query must not hide the other alert family.
        const [missingBc, openDemands] = await Promise.allSettled([
          canSeeOperations
            ? tachographApi.listMissingPurchaseOrders()
            : Promise.resolve([]),
          canSeeAllDemands ? tachographApi.listOpenDemands() : Promise.resolve([]),
        ])
        if (missingBc.status === 'rejected') {
          console.error('Error loading missing purchase orders:', missingBc.reason)
        }
        if (openDemands.status === 'rejected') {
          console.error('Error loading new demands:', openDemands.reason)
        }
        setBcItems(missingBc.status === 'fulfilled' ? missingBc.value || [] : [])
        setDemands(openDemands.status === 'fulfilled' ? openDemands.value || [] : [])
      } catch (e) {
        console.error('Error loading tachograph notifications:', e)
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [allowed, canSeeOperations, canSeeAllDemands]
  )

  useEffect(() => {
    load()
  }, [load])

  // Pick up work done in another tab (or after creating a demand/operation)
  // without polling.
  useEffect(() => {
    const refresh = () => load(true)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!allowed) return null

  const count = bcItems.length + demands.length
  const badge = count > 9 ? '9+' : String(count)

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev)
          if (!open) load(true)
        }}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={t('tachograph.notifications')}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell01 {...SF} className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('tachograph.notifications')}
          className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-apple border border-border bg-card shadow-apple-lg"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-[15px] font-semibold text-foreground">
                {t('tachograph.notifications')}
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {t('tachograph.notificationsDesc')}
              </p>
            </div>
            {count > 0 && (
              <span className="mt-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive/10 px-1.5 text-[11px] font-semibold text-destructive">
                {count}
              </span>
            )}
          </div>

          {loading ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
              {t('common.loading')}
            </p>
          ) : count === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <BellOff01 {...SF} className="h-6 w-6 text-muted-foreground" />
              <p className="text-[13px] font-medium text-foreground">{t('tachograph.notifEmpty')}</p>
              <p className="text-[12px] text-muted-foreground">{t('tachograph.notifEmptyDesc')}</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {demands.length > 0 && (
                <section>
                  <header className="flex items-center justify-between gap-2 bg-muted/50 px-4 py-1.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <FileCheck01 {...SF} className="h-3.5 w-3.5" />
                      {t('tachograph.notifDemands')}
                    </p>
                    <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
                      {demands.length}
                    </span>
                  </header>
                  <ul className="divide-y divide-border/60">
                    {demands.map((row) => {
                      const plates = [...new Set((row.items || []).map((item) => item.vehicle?.registration_plate).filter(Boolean))]
                      return (
                        <li key={`demand-${row.id}`}>
                          <Link
                            to="/tachograph/demandes"
                            onClick={() => setOpen(false)}
                            className="flex items-start justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-foreground">
                                {row.reference}
                              </p>
                              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                                {[plates.join(', '), row.chantier, formatDate(row.requested_on)]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                              {t('tachograph.demandStatusOpen')}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {bcItems.length > 0 && (
                <section>
                  <header className="flex items-center justify-between gap-2 bg-muted/50 px-4 py-1.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Receipt {...SF} className="h-3.5 w-3.5" />
                      {t('tachograph.notifMissingBc')}
                    </p>
                    <span className="rounded-full bg-destructive/10 px-1.5 text-[11px] font-semibold text-destructive">
                      {bcItems.length}
                    </span>
                  </header>
                  <ul className="divide-y divide-border/60">
                    {bcItems.map((row) => {
                      const late = Math.abs(daysUntil(row.performed_on) ?? 0)
                      return (
                        <li key={`bc-${row.id}`}>
                          <Link
                            to="/tachograph?bc=missing"
                            onClick={() => setOpen(false)}
                            className="flex items-start justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-foreground">
                                {row.vehicle?.registration_plate || row.vehicle?.code || '—'}
                                {row.vehicle?.code && (
                                  <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
                                    {row.vehicle.code}
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                                {[row.reference || t('tachograph.noDeliveryNote'), formatDate(row.performed_on)]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <span
                                title={late > 0 ? t('tachograph.notifDaysLate', { count: late }) : undefined}
                                className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive"
                              >
                                {t('tachograph.bcMissing')}
                              </span>
                              <p className="mt-1 text-[12px] tabular-nums text-muted-foreground">
                                {formatCurrency(row.price_paid)}
                              </p>
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 divide-x divide-border border-t border-border bg-muted/30">
            <Link
              to="/tachograph/demandes"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-primary transition-colors hover:bg-muted/60"
            >
              {t('tachograph.notifViewDemands')}
              <ChevronRight {...SF} className="h-4 w-4" />
            </Link>
            <Link
              to="/tachograph?bc=missing"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-primary transition-colors hover:bg-muted/60"
            >
              {t('tachograph.notifViewAll')}
              <ChevronRight {...SF} className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
