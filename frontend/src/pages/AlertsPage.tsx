import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCheck, Clock, MapPin } from 'lucide-react'
import { ackAlert, getAlerts, getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useLiveEvents, useThrottled } from '../services/live'
import StatusBadge from '../components/StatusBadge'
import { ErrorBox, Loading } from '../components/PageState'
import { PageHeader } from '../components/owner/ui'
import { ALERT_TITLE, formatAlertValue } from '../lib/status'
import { timeAgo } from '../lib/format'
import { positionName } from '../lib/tyreLayout'
import { placeName } from '../lib/route'
import type { Alert, TruckSummary } from '../types'
import { useLanguage } from '../i18n/LanguageProvider'

/*
 * Alert centre (docs/WEBSITE_SPEC.md section 2.6, stage W4).
 * Tabs: Open / Acknowledged / Resolved. Each alert: severity, truck, parameter,
 * plain-language message, time, location. Tap one for the detail page
 * (countdown, what to do, garages, book slot, share with driver, mark resolved).
 *
 * ?truck=<id> shows one truck only (used by "Book garage" buttons).
 */

type Tab = 'open' | 'acknowledged' | 'resolved'

export function alertState(a: Alert): Tab {
  if (a.resolved_at) return 'resolved'
  if (a.acknowledged_at) return 'acknowledged'
  return 'open'
}

export default function AlertsPage() {
  const { t } = useLanguage()
  const [params, setParams] = useSearchParams()
  const tab = (['open', 'acknowledged', 'resolved'].includes(params.get('tab') ?? '') ? params.get('tab') : 'open') as Tab
  const onlyTruck = params.get('truck')

  const alertsQ = useApi(() => getAlerts(), [])
  const trucksQ = useApi(getTrucks, [])
  const refresh = useThrottled(() => {
    alertsQ.reload()
    trucksQ.reload()
  }, 1000)
  useLiveEvents({ onAlert: refresh })

  const trucksById = new Map((trucksQ.data ?? []).map((tr) => [tr.id, tr]))
  const forTruck = (alertsQ.data ?? []).filter((a) => !onlyTruck || a.truck_id === onlyTruck)
  const shown = forTruck.filter((a) => alertState(a) === tab)
  const count = (x: Tab) => forTruck.filter((a) => alertState(a) === x).length

  const setTab = (x: Tab) => {
    const next = new URLSearchParams(params)
    if (x === 'open') next.delete('tab')
    else next.set('tab', x)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader title={t('alerts.title')} />

      <div className="inline-flex flex-wrap rounded-lg bg-white p-1 ring-1 ring-gray-200" role="tablist">
        {(['open', 'acknowledged', 'resolved'] as Tab[]).map((x) => (
          <button
            key={x}
            role="tab"
            aria-selected={tab === x}
            onClick={() => setTab(x)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition sm:px-4 ${
              tab === x ? 'bg-green-700 text-white' : 'text-navy-700 hover:bg-gray-100'
            }`}
          >
            {t(x === 'open' ? 'alerts.open' : x === 'acknowledged' ? 'alerts.acknowledged' : 'alerts.resolved')} ({count(x)})
          </button>
        ))}
      </div>

      {onlyTruck && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          Showing only <span className="font-semibold">{trucksById.get(onlyTruck)?.reg_no ?? 'one truck'}</span>
          <button
            onClick={() => {
              const next = new URLSearchParams(params)
              next.delete('truck')
              setParams(next, { replace: true })
            }}
            className="font-semibold text-green-700 underline hover:text-green-500"
          >
            Show all trucks
          </button>
        </p>
      )}

      <div className="mt-4">
        {(alertsQ.loading || trucksQ.loading) && !alertsQ.data && <Loading what="alerts" />}
        {alertsQ.error && <ErrorBox message={alertsQ.error} onRetry={alertsQ.reload} />}
        {alertsQ.data && shown.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-center text-navy-700 ring-1 ring-gray-200">
            {tab === 'open' ? 'No open alerts. All good.' : `No ${tab} alerts.`}
          </p>
        )}
        {alertsQ.data && trucksQ.data && (
          <ul className="space-y-3">
            {shown.map((a) => (
              <li key={a.id}>
                <AlertCard alert={a} truck={trucksById.get(a.truck_id)} onChanged={alertsQ.reload} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function AlertCard({ alert, truck, onChanged }: { alert: Alert; truck?: TruckSummary; onChanged: () => void }) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const tyre = truck?.tyres.find((ty) => ty.id === alert.tyre_id)
  const state = alertState(alert)

  async function acknowledge() {
    setBusy(true)
    setErr(null)
    try {
      await ackAlert(alert.id)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not acknowledge')
      setBusy(false)
    }
  }

  return (
    <article
      className={`rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 ${
        state === 'open' ? (alert.severity === 'critical' ? 'border-l-4 border-l-critical' : 'border-l-4 border-l-warning') : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">
            {ALERT_TITLE[alert.type]}
            {tyre && <span className="font-sans text-sm font-normal text-navy-700"> · {positionName(tyre.position)}</span>}
          </h2>
          <p className="text-sm">
            {truck ? (
              <Link to={`/owner/trucks/${truck.id}`} className="font-semibold text-green-700 hover:text-green-500">
                {truck.reg_no}
              </Link>
            ) : (
              'Unknown truck'
            )}{' '}
            · {formatAlertValue(alert.type, alert.value)}
          </p>
        </div>
        <StatusBadge status={alert.severity} />
      </div>
      <p className="mt-2 text-sm">{alert.message}</p>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-navy-700">
        <span className="inline-flex items-center gap-1">
          <Clock size={12} aria-hidden /> {timeAgo(alert.created_at)}
        </span>
        {truck?.lat != null && truck.lon != null && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} aria-hidden /> {placeName([truck.lat, truck.lon])}
          </span>
        )}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Link
          to={`/owner/alerts/${alert.id}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500"
        >
          {state === 'resolved' ? 'Details' : 'Open: garages & actions'} <ArrowRight size={16} aria-hidden />
        </Link>
        {state === 'open' && (
          <button
            onClick={acknowledge}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy-900/20 px-4 py-2.5 text-sm font-semibold hover:bg-green-50 disabled:opacity-50"
          >
            <CheckCheck size={16} aria-hidden /> {busy ? 'Saving…' : t('alerts.acknowledge')}
          </button>
        )}
      </div>
      {err && <p className="mt-2 text-sm text-critical">{err}</p>}
    </article>
  )
}
