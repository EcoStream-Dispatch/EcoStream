import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Reading } from '../types'
import { formatTimeIST } from '../lib/format'
import { kpaToBar, kpaToPsi, psiToKpa } from '../lib/units'

/*
 * Last 2 hours for one tyre: pressure, corrected pressure (psi, left axis)
 * and temperature (°C, right axis). Spec section 6.3.
 *
 * If "Pressure" goes up but "Corrected" stays flat, the tyre is just hot.
 * If "Corrected" slopes down, air is leaking.
 */
const COLORS = {
  pressure: '#0B1E36', // navy-900
  corrected: '#5C9A35', // green-500
  temp: '#94A3B8', // grey, dashed
  low: '#E0A100', // warning
}

interface Props {
  readings: Reading[]
  recommendedKpa: number
}

export default function TyreChart({ readings, recommendedKpa }: Props) {
  if (readings.length === 0) {
    return <p className="py-10 text-center text-sm text-navy-700">No readings in the last 2 hours.</p>
  }

  const data = readings.map((r) => ({
    time: formatTimeIST(r.ts),
    pressure: +kpaToPsi(r.pressure_kpa).toFixed(1),
    corrected: +kpaToPsi(r.corrected_kpa).toFixed(1),
    temp: r.temp_c,
  }))
  const lowPsi = +kpaToPsi(recommendedKpa * 0.9).toFixed(1)

  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#E5E7EB" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={40} />
          <YAxis
            yAxisId="psi"
            tick={{ fontSize: 11 }}
            domain={[(min: number) => Math.floor(Math.min(min, lowPsi) - 3), (max: number) => Math.ceil(max + 3)]}
            unit=" psi"
            width={62}
          />
          <YAxis yAxisId="temp" orientation="right" tick={{ fontSize: 11 }} domain={[20, 'auto']} unit="°" width={36} />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === 'Temperature'
                ? [`${value.toFixed(1)} °C`, name]
                : [`${value.toFixed(1)} psi · ${kpaToBar(psiToKpa(value)).toFixed(2)} bar`, name]
            }
            labelFormatter={(l) => `${l} IST`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine
            yAxisId="psi"
            y={lowPsi}
            stroke={COLORS.low}
            strokeDasharray="4 4"
            label={{ value: 'Low (90%)', fontSize: 10, fill: '#8a6400', position: 'insideBottomLeft' }}
          />
          <Line yAxisId="psi" type="monotone" dataKey="pressure" name="Pressure" stroke={COLORS.pressure} dot={false} isAnimationActive={false} strokeWidth={1.5} />
          <Line yAxisId="psi" type="monotone" dataKey="corrected" name="Corrected (20 °C)" stroke={COLORS.corrected} dot={false} isAnimationActive={false} strokeWidth={2.5} />
          <Line yAxisId="temp" type="monotone" dataKey="temp" name="Temperature" stroke={COLORS.temp} dot={false} isAnimationActive={false} strokeDasharray="5 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
