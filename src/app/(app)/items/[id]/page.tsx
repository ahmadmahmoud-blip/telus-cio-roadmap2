'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ChevronLeft,
  Pencil,
  Archive,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import { StatusBadge } from '@/components/items/StatusBadge'
import { PriorityBadge } from '@/components/items/PriorityBadge'
import { ItemForm, type ItemFormValues, type Area } from '@/components/items/ItemForm'
import { formatQuarter, relativeTime } from '@/lib/utils'

interface JiraLink {
  key: string
  url: string
  summary?: string
}

interface RoadmapItem {
  id: string
  title: string
  description?: string | null
  outcome?: string | null
  status: string
  priority: string
  confidence: string
  targetQuarterStart: string
  targetQuarterEnd: string
  labels: string[]
  jiraLinks: JiraLink[] | string[]
  createdAt: string
  updatedAt: string
  productArea: { id: string; name: string; color: string }
  createdBy?: { name: string; email: string }
  updatedBy?: { name: string; email: string }
}

interface AuditLog {
  id: string
  action: string
  timestamp: string
  changedBy: { name: string; email: string }
  diff: Record<string, { before?: unknown; after?: unknown; from?: unknown; to?: unknown }>
}

function AuditItem({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false)
  const hasDiff = Object.keys(log.diff).length > 0

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={!hasDiff}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 disabled:cursor-default"
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
              log.action === 'created'
                ? 'bg-green-500'
                : log.action === 'archived'
                ? 'bg-red-500'
                : 'bg-blue-500'
            }`}
          >
            {log.action === 'created' ? 'C' : log.action === 'archived' ? 'A' : 'U'}
          </span>
          <div>
            <p className="text-sm font-medium text-gray-800">
              <span className="capitalize">{log.action}</span> by {log.changedBy.name}
            </p>
            <p className="text-xs text-gray-500">{relativeTime(log.timestamp)}</p>
          </div>
        </div>
        {hasDiff && (
          open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {open && hasDiff && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left font-semibold text-gray-500 pb-1 w-1/4">Field</th>
                <th className="text-left font-semibold text-gray-500 pb-1 w-5/12">Before</th>
                <th className="text-left font-semibold text-gray-500 pb-1 w-5/12">After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(log.diff).map(([field, change]) => (
                <tr key={field}>
                  <td className="py-1 font-medium text-gray-600 capitalize">{field}</td>
                  <td className="py-1 text-red-600 line-through">
                    {String(change.before ?? change.from ?? '—')}
                  </td>
                  <td className="py-1 text-green-700">
                    {String(change.after ?? change.to ?? '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800">{children}</dd>
    </div>
  )
}

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [item, setItem] = useState<RoadmapItem | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(searchParams.get('edit') === 'true')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userRole, setUserRole] = useState<string>('viewer')

  const fetchItem = useCallback(async () => {
    try {
      const [itemRes, auditRes] = await Promise.all([
        fetch(`/api/items/${params.id}`),
        fetch(`/api/audit?entityId=${params.id}&entityType=RoadmapItem`),
      ])
      if (!itemRes.ok) throw new Error('Item not found')
      const itemData = await itemRes.json()
      setItem(itemData)

      if (auditRes.ok) {
        const auditData = await auditRes.json()
        // The audit API already parses diff to an object
        setAuditLogs(auditData.data ?? auditData)
      }
    } catch {
      toast.error('Failed to load item')
      router.push('/roadmap/list')
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => {
    fetchItem()
    Promise.all([
      fetch('/api/areas').then((r) => r.json()),
      fetch('/api/auth/session').then((r) => r.json()),
    ]).then(([areasData, session]) => {
      setAreas(areasData.data ?? areasData)
      setUserRole(session?.user?.role ?? 'viewer')
    })
  }, [fetchItem])

  const handleEdit = async (data: ItemFormValues) => {
    if (!item) return
    setIsSubmitting(true)
    try {
      const labels = data.labels
        ? data.labels.split(',').map((l) => l.trim()).filter(Boolean)
        : []
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, labels }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to update item')
      }
      toast.success('Item updated')
      setEditing(false)
      await fetchItem()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleArchive = async () => {
    if (!item) return
    if (!confirm(`Archive "${item.title}"? This can be undone by an admin.`)) return
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Item archived')
      router.push('/roadmap/list')
    } catch {
      toast.error('Failed to archive item')
    }
  }

  const isAdmin = userRole === 'admin'
  const isEditor = userRole === 'editor' || userRole === 'admin'

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 animate-pulse">
        <div className="mb-6 h-4 w-32 rounded bg-gray-200" />
        <div className="h-8 w-2/3 rounded bg-gray-200 mb-4" />
        <div className="flex gap-2 mb-6">
          <div className="h-6 w-20 rounded-full bg-gray-200" />
          <div className="h-6 w-20 rounded-full bg-gray-200" />
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 h-48 rounded-xl bg-gray-100" />
          <div className="h-48 rounded-xl bg-gray-100" />
        </div>
      </div>
    )
  }

  if (!item) return null

  const jiraLinks = item.jiraLinks as JiraLink[]
  const defaultFormValues: ItemFormValues = {
    title: item.title,
    productAreaId: item.productArea?.id ?? '',
    status: item.status,
    priority: item.priority,
    targetQuarterStart: item.targetQuarterStart,
    targetQuarterEnd: item.targetQuarterEnd,
    confidence: item.confidence,
    description: item.description ?? '',
    labels: item.labels?.join(', ') ?? '',
    outcome: item.outcome ?? '',
  }

  const quarterRange =
    item.targetQuarterStart === item.targetQuarterEnd
      ? formatQuarter(item.targetQuarterStart)
      : `${formatQuarter(item.targetQuarterStart)} → ${formatQuarter(item.targetQuarterEnd)}`

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Breadcrumb */}
      <Link
        href="/roadmap/list"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to roadmap
      </Link>

      {editing ? (
        /* ── Edit Mode ── */
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Edit Item</h1>
            <button
              onClick={() => setEditing(false)}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <ItemForm
            defaultValues={defaultFormValues}
            areas={areas}
            onSubmit={handleEdit}
            isSubmitting={isSubmitting}
            mode="edit"
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        /* ── View Mode ── */
        <>
          {/* Title + actions */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 leading-snug">{item.title}</h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isEditor && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleArchive}
                  className="flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <PriorityBadge priority={item.priority} />
            {item.confidence && item.confidence !== 'TBD' && (
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {item.confidence} confidence
              </span>
            )}
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-5">
              {item.description && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                    Description
                  </h2>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {item.description}
                  </p>
                </div>
              )}
              {item.outcome && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                    Outcome
                  </h2>
                  <p className="text-sm text-gray-700 leading-relaxed">{item.outcome}</p>
                </div>
              )}

              {/* Audit log */}
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                  History
                </h2>
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-gray-400">No audit history available.</p>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <AuditItem key={log.id} log={log} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar metadata */}
            <aside className="space-y-5">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
                  Details
                </h2>
                <dl className="space-y-4">
                  <MetaRow label="Product Area">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.productArea?.color }}
                      />
                      {item.productArea?.name ?? '—'}
                    </div>
                  </MetaRow>
                  <MetaRow label="Quarter">{quarterRange}</MetaRow>
                  <MetaRow label="Confidence">{item.confidence ?? '—'}</MetaRow>

                  {item.labels?.length > 0 && (
                    <MetaRow label="Labels">
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {item.labels.map((label) => (
                          <span
                            key={label}
                            className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </MetaRow>
                  )}

                  {jiraLinks?.length > 0 && (
                    <MetaRow label="Jira Links">
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {jiraLinks.map((link, i) => {
                          const key = typeof link === 'string' ? link : link.key
                          const url = typeof link === 'string' ? link : link.url
                          return (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            >
                              {key}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )
                        })}
                      </div>
                    </MetaRow>
                  )}

                  <div className="border-t border-gray-100 pt-3">
                    {item.createdBy && (
                      <MetaRow label="Created by">{item.createdBy.name}</MetaRow>
                    )}
                    <MetaRow label="Updated">{relativeTime(item.updatedAt)}</MetaRow>
                    <MetaRow label="Created">{new Date(item.createdAt).toLocaleDateString()}</MetaRow>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
