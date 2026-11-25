import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCheck, ChevronRight } from 'lucide-react'
import { ackAlert, getAlerts, getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useLiveEvents, useThrottled } from '../services/live'
import StatusBadge from '../components/StatusBadge'
import GarageList from '../components/GarageList'
import { ErrorBox, Loading } from '../components/PageState'
import { formatAlertValue } from '../lib/status'
import { formatDateTimeIST, timeAgo } from '../lib/format'
import { positionName } from '../lib/tyreLayout'
import { hoursUntilUnsafe } from '../lib/alerts'
import { useAlertText } from '../lib/alertText'
import { useLang } from '../lib/i18n'
import type { Alert, TruckSummary } from '../types'

type Filter = 'open' | 'closed'

/**
 * Alerts page (spec section 6.4): list with open/closed filter, acknowledge button,
 * and the 3 nearest open garages for each open alert.
 */
export default function AlertsPage() {
  const [filter, setFilter] = useState<Filter>('open')
  const { t } = useLang()
  const alertsQ = useApi(() => getAlerts(filter === 'open'), [filter])
  // Trucks give us the reg no, tyre position and location for each alert.
  const trucksQ = useApi(getTrucks, [])

  // Live: a new or changed alert -> refresh the list (and truck positions for garages).
  const refresh = useThrottled(() => {
    alertsQ.reload()
    trucksQ.reload()
  }, 1000)
  useLiveEvents({ onAlert: refresh })

  const trucksById = new Map((trucksQ.data ?? []).map((t) => [t.id, t]))

  return (
    <>
      <h1 className="text-2xl font-bold">{t('nav.alerts')}</h1>

      {/* Open / Closed filter */}
      <div className="mt-3 inline-flex rounded-lg bg-white p-1 ring-1 ring-gray-200" role="tablist">
        {(['open', 'closed'] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition ${
              filter === f ? 'bg-green-700 text-white' : 'text-navy-700 hover:bg-gray-100'
            }`}
          >
            {t(f === 'open' ? 'alerts.open' : 'alerts.closed')}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {(alertsQ.loading || trucksQ.loading) && !alertsQ.data && <Loading what="alerts" />}
        {alertsQ.error && <ErrorBox message={alertsQ.error} onRetry={alertsQ.reload} />}
        {alertsQ.data && alertsQ.data.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-center text-navy-700 ring-1 ring-gray-200">
            {filter === 'open' ? t('alerts.noneOpen') : t('alerts.noneClosed')}
          </p>
        )}
        {alertsQ.data && trucksQ.data && (
          <ul className="space-y-3">
            {alertsQ.data.map((a) => (
              <li key={a.id}>
                <AlertCard alert={a} truck={trucksById.get(a.truck_id)} onAcked={alertsQ.reload} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function AlertCard({ alert, truck, onAcked }: { alert: Alert; truck?: TruckSummary; onAcked: () => void }) {
  const [busy, setBusy] = useState(false)
  const [ackError, setAckError] = useState<string | null>(null)
  const tyre = truck?.tyres.find((t) => t.id === alert.tyre_id)
  const isOpen = !alert.acknowledged_at
  const { t } = useLang()
  const at = useAlertText()
  const countdown = isOpen ? at.unsafe(hoursUntilUnsafe(alert, truck)) : null

  async function acknowledge() {
    setBusy(true)
    setAckError(null)
    try {
      await ackAlert(alert.id)
      onAcked()
    } catch (e) {
      setAckError(e instanceof Error ? e.message : 'Could not acknowledge')
      setBusy(false)
    }
  }

  return (
    <article
      className={`rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 ${
        isOpen ? (alert.severity === 'critical' ? 'border-l-4 border-l-critical' : 'border-l-4 border-l-warning') : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">
            <Link to={`/alerts/${alert.id}`} className="hover:text-green-700">
              {at.title(alert.type)}
            </Link>
          </h2>
          <p className="text-sm text-navy-700">
            {truck ? (
              <Link to={`/trucks/${truck.id}`} className="font-semibold text-green-700 hover:text-green-500">
                {truck.reg_no}
              </Link>
            ) : (
              'Unknown truck'
            )}
            {tyre && ` · ${tyre.position} (${positionName(tyre.position)})`}
          </p>
        </div>
        <StatusBadge status={alert.severity} />
      </div>

      {countdown && (
        <p className="mt-2 inline-block rounded bg-critical px-2 py-1 font-heading text-xs font-bold uppercase text-white">{countdown}</p>
      )}
      <p className="mt-2 text-sm">{alert.message}</p>
      <p className="mt-1 text-sm font-semibold">{formatAlertValue(alert.type, alert.value)}</p>
      <p className="mt-1 text-xs text-navy-700">
        Raised {timeAgo(alert.created_at)} ({formatDateTimeIST(alert.created_at)} IST)
        {alert.acknowledged_at && ` · Acknowledged ${formatDateTimeIST(alert.acknowledged_at)} IST`}
      </p>

      <Link
        to={`/alerts/${alert.id}`}
        className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-700"
      >
        {isOpen ? t('alerts.openDetail') : t('alerts.view')} <ChevronRight size={16} aria-hidden />
      </Link>

      {isOpen && (
        <>
          <h3 className="mt-4 mb-2 text-sm font-bold uppercase tracking-wide text-navy-700">{t('alerts.garages')}</h3>
          <GarageList lat={truck?.lat ?? null} lon={truck?.lon ?? null} />

          <button
            onClick={acknowledge}
            disabled={busy}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-navy-900/20 px-4 py-2.5 font-semibold text-navy-900 transition hover:bg-green-50 disabled:opacity-50 sm:w-auto"
          >
            <CheckCheck size={18} aria-hidden /> {busy ? t('alerts.saving') : t('alerts.ack')}
          </button>
          {ackError && <p className="mt-2 text-sm text-critical">{ackError}</p>}
        </>
      )}
    </article>
  )
}
