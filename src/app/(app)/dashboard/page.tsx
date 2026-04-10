import { prisma } from '@/lib/prisma'
import { formatQuarter, relativeTime, ALL_STATUSES } from '@/lib/utils'
import { StatusBadge } from '@/components/items/StatusBadge'
import { DomainHealthGrid, type DomainData } from '@/components/dashboard/DomainHealthGrid'
import { QuickSearch } from '@/components/dashboard/QuickSearch'
import {
  Package,
  CheckCircle2,
  Zap,
  AlertOctagon,
  Clock,
  Activity,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ─── Data fetching ──────────────────────────────────────────────────────────

async function getDashboardData() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentQuarterNum = Math.floor(now.getMonth() / 3) + 1
  const currentQuarter = `${currentYear}-Q${currentQuarterNum}`

  const [
    totalItems,
    byStatus,
    byDomain,
    atRiskItems,
    recentAudit,
  ] = await Promise.all([
    prisma.roadmapItem.count({ where: { archivedAt: null } }),

    prisma.roadmapItem.groupBy({
      by: ['status'],
      where: { archivedAt: null },
      _count: { status: true },
    }),

    // Domain-level hierarchy with all items
    prisma.productDomain.findMany({
      include: {
        groups: {
          include: {
            areas: {
              include: {
                items: {
                  where: { archivedAt: null },
                  select: { status: true },
                },
              },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),

    prisma.roadmapItem.findMany({
      where: {
        archivedAt: null,
        status: { notIn: ['Shipped', 'Cancelled'] },
        targetQuarterEnd: { lt: currentQuarter },
      },
      include: {
        productArea: { select: { name: true, color: true } },
      },
      orderBy: { targetQuarterEnd: 'asc' },
      take: 10,
    }),

    prisma.auditLog.findMany({
      include: { changedBy: { select: { name: true } } },
      orderBy: { timestamp: 'desc' },
      take: 10,
    }),
  ])

  // Build status map
  const statusMap: Record<string, number> = {}
  for (const row of byStatus) statusMap[row.status] = row._count.status

  // Build domain data for DomainHealthGrid
  const domainData: DomainData[] = byDomain.map((domain) => {
    const groups = domain.groups.map((group) => {
      const gItems = group.areas.flatMap((a) => a.items)
      const gCounts: Record<string, number> = {}
      for (const item of gItems) gCounts[item.status] = (gCounts[item.status] ?? 0) + 1
      return {
        id: group.id,
        name: group.name,
        color: group.color,
        statusCounts: gCounts,
        total: gItems.length,
        areaIds: group.areas.map((a) => a.id),
      }
    })
    const allItems = domain.groups.flatMap((g) => g.areas.flatMap((a) => a.items))
    const statusCounts: Record<string, number> = {}
    for (const item of allItems) statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1
    return {
      id: domain.id,
      name: domain.name,
      color: domain.color,
      statusCounts,
      total: allItems.length,
      groups,
      areaIds: domain.groups.flatMap((g) => g.areas.map((a) => a.id)),
    }
  })

  return { totalItems, statusMap, domainData, atRiskItems, recentAudit }
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  subtext,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  subtext?: string
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{value.toLocaleString()}</p>
            {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
          </div>
          <div className={`rounded-xl p-2.5 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Activity feed item ──────────────────────────────────────────────────────

function AuditEntry({
  action,
  entityTitle,
  changedBy,
  timestamp,
}: {
  action: string
  entityTitle?: string | null
  changedBy: { name: string }
  timestamp: Date
}) {
  const actionColor: Record<string, string> = {
    created: 'bg-green-500',
    updated: 'bg-blue-500',
    archived: 'bg-gray-400',
  }

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-1.5 flex-shrink-0">
        <span className={`block h-2 w-2 rounded-full ${actionColor[action] ?? 'bg-slate-400'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700 leading-snug">
          <span className="font-medium">{changedBy.name}</span>{' '}
          <span className="text-slate-500">{action}</span>{' '}
          <span className="font-medium truncate">{entityTitle ?? 'an item'}</span>
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{relativeTime(timestamp)}</p>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { totalItems, statusMap, domainData, atRiskItems, recentAudit } =
    await getDashboardData()

  const shipped = statusMap['Shipped'] ?? 0
  const inProgress = statusMap['In Progress'] ?? 0
  const blocked = statusMap['Blocked'] ?? 0

  return (
    <div className="min-h-full px-6 py-8 lg:px-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your product roadmap health and recent activity.
        </p>
      </div>

      {/* Quick search */}
      <div className="mb-6">
        <QuickSearch />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatCard
          label="Total Items"
          value={totalItems}
          icon={Package}
          color="bg-indigo-50 text-indigo-600"
          subtext="Non-archived"
        />
        <StatCard
          label="Shipped"
          value={shipped}
          icon={CheckCircle2}
          color="bg-green-50 text-green-600"
          subtext={totalItems > 0 ? `${Math.round((shipped / totalItems) * 100)}% complete` : undefined}
        />
        <StatCard
          label="In Progress"
          value={inProgress}
          icon={Zap}
          color="bg-yellow-50 text-yellow-600"
        />
        <StatCard
          label="Blocked"
          value={blocked}
          icon={AlertOctagon}
          color="bg-red-50 text-red-600"
          subtext={blocked > 0 ? 'Needs attention' : 'All clear'}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        {/* Domain health grid — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Domain Health</CardTitle>
            <p className="text-xs text-muted-foreground">
              Click a domain card to drill into its product group breakdown
            </p>
          </CardHeader>
          <CardContent>
            <DomainHealthGrid domains={domainData} />
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-400" />
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentAudit.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No activity yet</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentAudit.map((entry) => (
                  <AuditEntry
                    key={entry.id}
                    action={entry.action}
                    entityTitle={entry.entityTitle}
                    changedBy={entry.changedBy}
                    timestamp={entry.timestamp}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Items */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-base font-semibold">At-Risk Items</CardTitle>
            {atRiskItems.length > 0 && (
              <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                {atRiskItems.length}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Items past their target quarter that are not yet shipped or cancelled
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {atRiskItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-400 mb-3" />
              <p className="text-sm font-medium text-slate-600">No at-risk items</p>
              <p className="text-xs text-slate-400 mt-1">Everything is on track.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="pl-6 pr-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Product Area</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Target</th>
                    <th className="pl-3 pr-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {atRiskItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="pl-6 pr-3 py-3">
                        <span className="font-medium text-slate-800 line-clamp-1">{item.title}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: item.productArea.color }} />
                          <span className="text-slate-600 text-xs">{item.productArea.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-xs font-medium">
                        {formatQuarter(item.targetQuarterEnd)}
                      </td>
                      <td className="pl-3 pr-6 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
