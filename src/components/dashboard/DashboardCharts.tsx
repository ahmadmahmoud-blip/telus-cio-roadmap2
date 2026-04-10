'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ALL_STATUSES, STATUS_BAR_COLORS } from '@/lib/utils'

interface ChartDataEntry {
  name: string
  [status: string]: string | number
}

interface DashboardChartsProps {
  chartData: ChartDataEntry[]
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; fill: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0)
  return (
    <div className="rounded-lg border bg-white px-3 py-2.5 shadow-xl text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-slate-800 mb-1.5">{label}</p>
      {payload
        .filter((p) => p.value > 0)
        .map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.fill }}
              />
              <span className="text-slate-600">{p.name}</span>
            </div>
            <span className="font-semibold text-slate-800">{p.value}</span>
          </div>
        ))}
      <div className="border-t border-slate-100 pt-1 mt-1 flex justify-between">
        <span className="text-slate-500">Total</span>
        <span className="font-semibold text-slate-800">{total}</span>
      </div>
    </div>
  )
}

export function DashboardCharts({ chartData }: DashboardChartsProps) {
  if (chartData.length === 0 || chartData.every((d) => (d.total as number) === 0)) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No data to display yet.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={chartData}
        margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
        barCategoryGap="30%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          interval={0}
          // shorten long area names on axis
          tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + '…' : v)}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
          iconType="circle"
          iconSize={8}
        />
        {ALL_STATUSES.map((status) => (
          <Bar
            key={status}
            dataKey={status}
            stackId="a"
            fill={STATUS_BAR_COLORS[status]}
            radius={status === ALL_STATUSES[ALL_STATUSES.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={48}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
