import { useEffect, useState } from 'react'
import { BatteryMedium, Cog, Disc3, Lock, Thermometer } from 'lucide-react'
import TyreLayout from '../../components/TyreLayout'
import StatusBadge from '../../components/StatusBadge'
import { useApi } from '../../hooks/useApi'
import { getTruckDetails } from '../../services/api'
import { PARAMS, type ParamGroup } from '../../data/plans'
import { formatPsi, formatTemp } from '../../lib/units'
import { positionName } from '../../lib/tyreLayout'
import { isUnlocked, worst, worstTyreStatus } from '../owner/truck/tabs'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { TyreStatus } from '../../types'
import { useDriver } from './DriverLayout'

/*
 * Driver: Truck health cockpit (docs/WEBSITE_SPEC.md section 3.2).
 * Big tyre diagram with colours + symbols, simple engine / brakes / battery tiles,
 * any active alert at the top (the banner in DriverLayout).
 */

const SYSTEMS: { name: string; icon: typeof Cog; groups: ParamGroup[] }[] = [
  { name: 'Engine', icon: Cog, groups: ['Engine'] },
  { name: 'Brakes', icon: Disc3, groups: ['Brakes & Chassis'] },
  { name: 'Battery', icon: BatteryMedium, groups: ['Power'] },
]

export default function TruckCockpitPage() {
  const { t } = useLanguage()
  const { home } = useDriver()
  const { truck } = home
  const detailsQ = useApi(() => getTruckDetails(truck, home.openAlerts), [truck])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Start with the worst tyre selected.
  useEffect(() => {
    if (!selectedId) {
      const rank = { critical: 0, warning: 1, offline: 2, ok: 3 }
      setSelectedId([...truck.tyres].sort((a, b) => rank[a.status] - rank[b.status])[0]?.id ?? null)
    }
  }, [truck, selectedId])

  const tyre = truck.tyres.find((ty) => ty.id === selectedId)
  const tyresStatus = worstTyreStatus(truck.tyres.map((ty) => ty.status))
  const values = new Map((detailsQ.data?.params ?? []).map((v) => [v.key, v]))

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">{t('driver.truck')}</h1>
          <StatusBadge status={tyresStatus} className="text-sm" />
        </div>
        {tyresStatus === 'ok' && <p className="mt-1 text-green-700">{t('driver.allGood')}</p>}
        <TyreLayout
          axleConfig={truck.axle_config}
          tyres={truck.tyres}
          selectedId={selectedId}
          onSelect={setSelectedId}
          className="mx-auto mt-3 w-full max-w-[340px]"
        />
        {tyre && (
          <div className="mt-3 rounded-xl bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-lg font-bold">
                {tyre.position} <span className="text-sm font-normal text-navy-700">{positionName(tyre.position)}</span>
              </p>
              <StatusBadge status={tyre.status} />
            </div>
            {tyre.latest ? (
              <p className="mt-1 flex flex-wrap items-baseline gap-x-4 text-2xl font-bold">
                <span>{formatPsi(tyre.latest.pressure_kpa)}</span>
                <span className="inline-flex items-center gap-1 text-xl">
                  <Thermometer size={20} aria-hidden /> {formatTemp(tyre.latest.temp_c)}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-navy-700">No data from this sensor.</p>
            )}
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 gap-3">
        {SYSTEMS.map(({ name, icon: Icon, groups }) => {
          const params = detailsQ.data ? PARAMS.filter((p) => groups.includes(p.group) && isUnlocked(p, detailsQ.data!.profile)) : []
          const status: TyreStatus | null = params.length ? worst(params.map((p) => values.get(p.key)!).filter(Boolean)) : null
          return (
            <div key={name} className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-gray-200">
              <Icon size={34} className="text-navy-900" aria-hidden />
              <p className="font-bold">{name}</p>
              {!detailsQ.data ? (
                <span className="text-xs text-navy-700">…</span>
              ) : status ? (
                <StatusBadge status={status} />
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600">
                  <Lock size={12} aria-hidden /> Not monitored
                </span>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
