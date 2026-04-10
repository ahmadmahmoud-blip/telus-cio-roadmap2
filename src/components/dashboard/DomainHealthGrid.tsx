'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { X, ExternalLink } from 'lucide-react'
import { cn, ALL_STATUSES, STATUS_BAR_COLORS } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface GroupData {
  id: string
  name: string
  color: string
  statusCounts: Record<string, number>
  total: number
  areaIds: string[]
}

export interface DomainData {
  id: string
  name: string
  color: string
  statusCounts: Record<string, number>
  total: number
  groups: GroupData[]
  areaIds: string[]
}

const STATUS_DOTS: Record<string, string> = {
  Discovery: 'bg-slate-400',
  Planned: 'bg-blue-400',
  'In Progress': 'bg-yellow-400',
  Shipped: 'bg-green-500',
  Blocked: 'bg-red-500',
  Cancelled: 'bg-gray-300',
}

function ProgressBar({ shipped, total }: { shipped: number; total: number }) {
  const pct = total > 0 ? Math.round((shipped / total) * 100) : 0
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-400">Completion</span>
        <span className="text-[10px] font-semibold text-slate-600">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const DrillDownTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; fill: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="rounded-lg border bg-white px-3 py-2.5 shadow-xl text-xs space-y-1 min-w-[140px]">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.filter((p) => p.value > 0).map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.fill }} />
            <span className="text-slate-600">{p.name}</span>
          </div>
          <span className="font-semibold text-slate-800">{p.value}</span>
        </div>
      ))}
      <div className="border-t border-slate-100 pt-1 mt-1 flex justify-between">
        <span className="text-slate-500">Total</span>
        <span className="font-semibold">{total}</span>
      </div>
    </div>
  )
}

function DrillDownPanel({ domain, onClose }: { domain: DomainData; onClose: () => void }) {
  const chartData = domain.groups.map((g) => {
    const entry: Record<string, string | number> = { name: g.name, total: g.total }
    for (const status of ALL_STATUSES) entry[status] = g.statusCounts[status] ?? 0
    return entry
  })

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: domain.color }} />
            <CardTitle className="text-sm font-semibold text-slate-800">{domain.name} — Group Breakdown</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/roadmap/list?areas=${domain.areaIds.join(',')}`}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              View all items <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {domain.groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No product groups in this domain.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, domain.groups.length * 40)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + '…' : v)}
              />
              <Tooltip content={<DrillDownTooltip />} cursor={{ fill: '#f8fafc' }} />
              {ALL_STATUSES.map((status) => (
                <Bar
                  key={status}
                  dataKey={status}
                  stackId="a"
                  fill={STATUS_BAR_COLORS[status]}
                  radius={status === ALL_STATUSES[ALL_STATUSES.length - 1] ? [0, 3, 3, 0] : [0, 0, 0, 0]}
                  maxBarSize={28}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={STATUS_BAR_COLORS[status]} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3">
          {ALL_STATUSES.map((s) => (
            <div key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_BAR_COLORS[s] }} />
              {s}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function DomainHealthGrid({ domains }: { domains: DomainData[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedDomain = domains.find((d) => d.id === selectedId) ?? null

  if (domains.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-slate-400">No product domains configured yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {domains.map((domain) => {
          const shipped = domain.statusCounts['Shipped'] ?? 0
          const isSelected = selectedId === domain.id
          const nonZeroStatuses = ALL_STATUSES.filter((s) => (domain.statusCounts[s] ?? 0) > 0)

          return (
            <button
              key={domain.id}
              onClick={() => setSelectedId(isSelected ? null : domain.id)}
              className={cn(
                'text-left rounded-xl border bg-white p-4 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 border-l-4',
                isSelected
                  ? 'ring-2 ring-indigo-400 ring-offset-1 shadow-md'
                  : 'hover:ring-1 hover:ring-slate-200'
              )}
              style={{ borderLeftColor: domain.color }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 truncate">{domain.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {domain.total} item{domain.total !== 1 ? 's' : ''} &middot; {domain.groups.length} group{domain.groups.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    shipped > 0 && domain.total > 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {domain.total > 0 ? `${Math.round((shipped / domain.total) * 100)}%` : '—'}
                </span>
              </div>

              {/* Status dots */}
              {nonZeroStatuses.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {nonZeroStatuses.map((s) => (
                    <div key={s} className="flex items-center gap-1 text-[10px] text-slate-500">
                      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', STATUS_DOTS[s])} />
                      {domain.statusCounts[s]}
                    </div>
                  ))}
                </div>
              )}

              <ProgressBar shipped={shipped} total={domain.total} />

              <p className="mt-2 text-[10px] text-indigo-500 font-medium">
                {isSelected ? 'Click to collapse ↑' : 'Click to expand ↓'}
              </p>
            </button>
          )
        })}
      </div>

      {selectedDomain && (
        <DrillDownPanel domain={selectedDomain} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
