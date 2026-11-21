import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clock, UserRound } from 'lucide-react'
import { useApi } from '../../../hooks/useApi'
import { useLiveEvents, useThrottled } from '../../../services/live'
import { getAlerts, getTruck, getTruckDetails } from '../../../services/api'
import { truckHealth } from '../../../lib/status'
import { timeAgo } from '../../../lib/format'
import { AXLE_CONFIG_LABEL } from '../../../lib/tyreLayout'
import { DemoTag, PlanBadge } from '../../../components/owner/ui'
import { ErrorBox, Loading } from '../../../components/PageState'
import StatusBadge from '../../../components/StatusBadge'
import OverviewTab from './OverviewTab'
import TyresTab from './TyresTab'
import ParamsTab from './ParamsTab'
import PredictionsTab from './PredictionsTab'
import MaintenanceTab from './MaintenanceTab'
import { TABS, type TabId } from './tabs'

/*
 * Truck detail (docs/WEBSITE_SPEC.md section 2.4).
 * Header: registration, model, plan, driver, live status, last seen.
 * Tabs: Overview, Tyres, Engine, Brakes & Chassis, Power & Device, Driver, Cargo,
 *       Predictions, Maintenance & documents. The tab is in the URL (?tab=engine),
 *       so links can open a tab directly.
 *
 * Tyre data is real (sensors / simulator). Everything else is sample data for now.
 */
export default function TruckDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'overview') as TabId

  const truckQ = useApi(() => getTruck(id), [id])
  const alertsQ = useApi(() => getAlerts(true), [id])
  const truck = truckQ.data
  const detailsQ = useApi(
    () => (truck && alertsQ.data ? getTruckDetails(truck, alertsQ.data) : Promise.resolve(null)),
    [truck, alertsQ.data],
  )

  // Live: a new reading or alert for this truck -> refresh the header and tabs.
  const refresh = useThrottled(() => {
    truckQ.reload()
    alertsQ.reload()
  }, 3000)
  useLiveEvents({
    onAlert: (a) => a.truck_id === id && refresh(),
    onReading: (r) => truck?.tyres.some((t) => t.id === r.tyre_id) && refresh(),
  })

  if (truckQ.loading && !truck) return <Loading what="truck" />
  if (truckQ.error) return <ErrorBox message={truckQ.error} onRetry={truckQ.reload} />
  if (!truck) {
    return (
      <p className="py-10 text-center">
        Truck not found.{' '}
        <Link to="/owner/trucks" className="font-semibold text-green-700">
          Back to trucks
        </Link>
      </p>
    )
  }

  const details = detailsQ.data
  const openAlerts = (alertsQ.data ?? []).filter((a) => a.truck_id === truck.id)

  return (
    <>
      <Link to="/owner/trucks" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-500">
        <ArrowLeft size={16} aria-hidden /> Trucks
      </Link>

      {/* Header */}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-wide">{truck.reg_no}</h1>
            {details && <PlanBadge plan={details.profile.plan} />}
          </div>
          <p className="text-sm text-navy-700">
            {truck.make} {truck.model} · {AXLE_CONFIG_LABEL[truck.axle_config]}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-navy-700">
            <span className="inline-flex items-center gap-1">
              <UserRound size={14} aria-hidden /> {details ? (details.driver?.name ?? 'No driver assigned') : '…'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={14} aria-hidden /> Last seen {timeAgo(truck.last_seen_at)}
            </span>
          </p>
        </div>
        <StatusBadge status={truckHealth(truck)} className="text-sm" />
      </div>

      {/* Tabs: scroll sideways on phones */}
      <div className="-mx-4 mt-4 overflow-x-auto border-b border-gray-200 px-4 lg:mx-0 lg:px-0">
        <div role="tablist" aria-label="Truck sections" className="flex min-w-max gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setParams(t.id === 'overview' ? {} : { tab: t.id }, { replace: true })}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                tab === t.id ? 'border-green-700 text-green-700' : 'border-transparent text-navy-700 hover:text-navy-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4" role="tabpanel">
        {tab !== 'tyres' && tab !== 'overview' && (
          <div className="mb-3">
            <DemoTag />
          </div>
        )}
        {tab === 'tyres' ? (
          <TyresTab truck={truck} extras={details?.tyres ?? []} />
        ) : !details ? (
          detailsQ.error ? <ErrorBox message={detailsQ.error} onRetry={detailsQ.reload} /> : <Loading what="truck details" />
        ) : tab === 'overview' ? (
          <OverviewTab truck={truck} details={details} openAlerts={openAlerts} />
        ) : tab === 'predictions' ? (
          <PredictionsTab truck={truck} predictions={details.predictions} />
        ) : tab === 'maintenance' ? (
          <MaintenanceTab details={details} />
        ) : (
          <ParamsTab truck={truck} details={details} groups={TABS.find((t) => t.id === tab)!.groups!} />
        )}
      </div>
    </>
  )
}
