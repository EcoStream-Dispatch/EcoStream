import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, IndianRupee, ShieldCheck, BellRing } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { getReports, tyreCostByBrand } from '../../services/api'
import { Card, CardTitle, DemoTag, Kpi, PageHeader, rupees } from '../../components/owner/ui'
import { ErrorBox, Loading } from '../../components/PageState'
import { useLanguage } from '../../i18n/LanguageProvider'

/*
 * Reports (docs/WEBSITE_SPEC.md section 2.11): monthly savings, tyre cost per km by brand,
 * fuel efficiency, idle time, alerts acted on, breakdowns avoided; download PDF.
 * SAMPLE numbers (no history backend yet). "Download PDF" uses the browser's
 * print dialog (choose "Save as PDF"); the sidebar and top bar are hidden when printing.
 *
 * Charts: one series each (brand green), one y-axis each, hover tooltips, and the same
 * numbers in a table below (docs: dataviz rules - no dual axes, never colour alone).
 */

const GREEN = '#5C9A35'
const AXIS = { fontSize: 12, fill: '#1D323A' }

export default function ReportsPage() {
  const { t } = useLanguage()
  const q = useApi(getReports, [])
  if (q.loading && !q.data) return <Loading what="reports" />
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />
  const rows = q.data ?? []
  const last = rows[rows.length - 1]
  const total = rows.reduce((s, r) => s + r.saved_rupees, 0)
  const brands = tyreCostByBrand()

  return (
    <>
      <PageHeader
        title={t('owner.reports')}
        subtitle="Last 6 months"
        right={
          <div className="flex items-center gap-2 print:hidden">
            <DemoTag />
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white hover:bg-green-500">
              <Download size={18} aria-hidden /> Download PDF
            </button>
          </div>
        }
      />
      <p className="mb-3 hidden text-sm print:block">EcoStream report · sample data · printed {new Date().toLocaleDateString('en-IN')}</p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Saved this month (estimate)" value={rupees(last?.saved_rupees ?? 0)} icon={IndianRupee} tone="ok" />
        <Kpi label="Saved in 6 months (estimate)" value={rupees(total)} icon={IndianRupee} tone="ok" />
        <Kpi label="Breakdowns avoided this month" value={last?.breakdowns_avoided ?? 0} icon={ShieldCheck} tone="ok" />
        <Kpi label="Alerts acted on this month" value={last?.alerts_acted_on ?? 0} icon={BellRing} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 print:grid-cols-2">
        <ChartCard title="Estimated savings per month (₹)">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => (v ? `₹${v / 1000}k` : '₹0')} />
            <Tooltip formatter={(v: number) => [rupees(v), 'Saved']} cursor={{ fill: '#F4F9F1' }} />
            <Bar isAnimationActive={false} dataKey="saved_rupees" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Tyre cost by brand (₹ per 100 km)">
          <BarChart data={brands} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="#E5E7EB" />
            <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="brand" tick={AXIS} axisLine={false} tickLine={false} width={120} />
            <Tooltip formatter={(v: number) => [`₹${v} per 100 km`, 'Tyre cost']} cursor={{ fill: '#F4F9F1' }} />
            <Bar isAnimationActive={false} dataKey="per100km" fill={GREEN} radius={[0, 4, 4, 0]} maxBarSize={28} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Fuel efficiency (km per litre)">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} domain={[3, 4]} ticks={[3, 3.25, 3.5, 3.75, 4]} tickFormatter={(v: number) => v.toFixed(2)} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)} km/L`, 'Fuel efficiency']} />
            <Line isAnimationActive={false} dataKey="fuel_km_per_l" stroke={GREEN} strokeWidth={2} dot={{ r: 4, fill: GREEN }} activeDot={{ r: 6 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Idle time (minutes per truck per day)">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v: number) => [`${v} min/day`, 'Idle time']} />
            <Line isAnimationActive={false} dataKey="idle_min_per_day" stroke={GREEN} strokeWidth={2} dot={{ r: 4, fill: GREEN }} activeDot={{ r: 6 }} />
          </LineChart>
        </ChartCard>
      </div>

      {/* Same numbers as a table (screen readers, printing, copying) */}
      <Card className="mt-4 overflow-x-auto">
        <CardTitle>Month by month</CardTitle>
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-navy-700">
            <tr>
              {['Month', 'Saved (est.)', 'Breakdowns avoided', 'Alerts acted on', 'Fuel km/L', 'Idle min/day'].map((h) => (
                <th key={h} scope="col" className="py-2 pr-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.month}>
                <td className="py-2 pr-3 font-semibold">{r.month}</td>
                <td className="py-2 pr-3">{rupees(r.saved_rupees)}</td>
                <td className="py-2 pr-3">{r.breakdowns_avoided}</td>
                <td className="py-2 pr-3">{r.alerts_acted_on}</td>
                <td className="py-2 pr-3">{r.fuel_km_per_l.toFixed(2)}</td>
                <td className="py-2 pr-3">{r.idle_min_per_day}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-navy-700">Savings estimate: ₹25,000 per breakdown avoided (sample assumption). All numbers on this page are sample data.</p>
      </Card>
    </>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="break-inside-avoid">
      <CardTitle>{title}</CardTitle>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
