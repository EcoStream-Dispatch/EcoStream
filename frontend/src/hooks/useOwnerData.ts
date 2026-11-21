import { getAlerts, getShipments, getTrucks } from '../services/api'
import { useLiveEvents, useThrottled } from '../services/live'
import { useApi } from './useApi'

/**
 * Trucks + open alerts (+ shipments) for the owner pages, kept fresh by live updates.
 *   const { trucks, openAlerts, shipments, loading, error, reload } = useOwnerData()
 */
export function useOwnerData() {
  const trucksQ = useApi(getTrucks, [])
  const alertsQ = useApi(() => getAlerts(true), [])
  const shipmentsQ = useApi(() => (trucksQ.data ? getShipments(trucksQ.data) : Promise.resolve(null)), [trucksQ.data])

  const reload = useThrottled(() => {
    trucksQ.reload()
    alertsQ.reload()
  }, 3000)
  useLiveEvents({ onReading: reload, onAlert: reload })

  return {
    trucks: trucksQ.data,
    openAlerts: alertsQ.data,
    shipments: shipmentsQ.data,
    loading: trucksQ.loading || alertsQ.loading,
    error: trucksQ.error ?? alertsQ.error,
    reload: () => {
      trucksQ.reload()
      alertsQ.reload()
    },
  }
}
