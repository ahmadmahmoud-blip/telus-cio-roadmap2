'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Pencil,
  Archive,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/items/StatusBadge'
import { PriorityBadge } from '@/components/items/PriorityBadge'
import { ImportCsvDialog } from '@/components/items/ImportCsvDialog'
import {
  cn,
  formatQuarter,
  relativeTime,
  ALL_STATUSES,
  ALL_PRIORITIES,
} from '@/lib/utils'

interface ProductArea {
  id: string
  name: string
  color: string
}

interface RoadmapItem {
  id: string
  title: string
  status: string
  priority: string
  targetQuarterStart: string
  targetQuarterEnd: string
  updatedAt: string
  productArea: ProductArea
  labels: string[]
}

interface ApiResponse {
  data: RoadmapItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface SelectOption {
  value: string
  label: string
}

function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: SelectOption[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt])
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
          value.length > 0
            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
        )}
      >
        {label}
        {value.length > 0 && (
          <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] text-white">
            {value.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-52 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={value.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

const columnHelper = createColumnHelper<RoadmapItem>()

function RoadmapListPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialArea = searchParams.get('area') ?? ''
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  const [search, setSearch] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([])
  const [selectedAreas, setSelectedAreas] = useState<string[]>(initialArea ? [initialArea] : [])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('viewer')

  const [importOpen, setImportOpen] = useState(false)

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchItems = useCallback(async (params: {
    search: string
    statuses: string[]
    priorities: string[]
    areas: string[]
    page: number
  }) => {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (params.search) sp.set('search', params.search)
      if (params.statuses.length) sp.set('statuses', params.statuses.join(','))
      if (params.priorities.length) sp.set('priorities', params.priorities.join(','))
      if (params.areas.length) sp.set('areas', params.areas.join(','))
      sp.set('page', String(params.page))
      sp.set('pageSize', String(PAGE_SIZE))

      const res = await fetch(`/api/items?${sp.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch items')
      const data: ApiResponse = await res.json()
      setItems(data.data)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((s) => setUserRole(s?.user?.role ?? 'viewer'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setPage(1)
      fetchItems({ search, statuses: selectedStatuses, priorities: selectedPriorities, areas: selectedAreas, page: 1 })
    }, 300)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedStatuses, selectedPriorities, selectedAreas])

  useEffect(() => {
    fetchItems({ search, statuses: selectedStatuses, priorities: selectedPriorities, areas: selectedAreas, page })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const handleArchive = async (id: string, title: string) => {
    if (!confirm(`Archive "${title}"? This can be undone by an admin.`)) return
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Item archived')
      fetchItems({ search, statuses: selectedStatuses, priorities: selectedPriorities, areas: selectedAreas, page })
    } catch {
      toast.error('Failed to archive item')
    }
  }

  const exportCSV = () => {
    const headers = ['Title', 'Product Area', 'Status', 'Priority', 'Quarter Start', 'Quarter End', 'Updated']
    const rows = items.map((item) => [
      `"${item.title.replace(/"/g, '""')}"`,
      `"${item.productArea?.name ?? ''}"`,
      item.status,
      item.priority,
      formatQuarter(item.targetQuarterStart),
      formatQuarter(item.targetQuarterEnd),
      new Date(item.updatedAt).toLocaleDateString(),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roadmap-items-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isAdmin = userRole === 'admin'
  const isEditor = userRole === 'editor' || userRole === 'admin'

  const columns = [
    columnHelper.accessor('title', {
      header: 'Title',
      cell: (info) => (
        <button
          onClick={() => router.push(`/items/${info.row.original.id}`)}
          className="text-left font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
        >
          {info.getValue()}
        </button>
      ),
    }),
    columnHelper.accessor('productArea', {
      header: 'Product Area',
      cell: (info) => {
        const area = info.getValue()
        return area ? (
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: area.color }}
            />
            <span className="text-sm text-gray-700">{area.name}</span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        )
      },
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('priority', {
      header: 'Priority',
      cell: (info) => <PriorityBadge priority={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'quarter',
      header: 'Quarter',
      cell: (info) => {
        const item = info.row.original
        const start = formatQuarter(item.targetQuarterStart)
        const end = formatQuarter(item.targetQuarterEnd)
        return (
          <span className="text-sm text-gray-600 whitespace-nowrap">
            {start === end ? start : `${start} → ${end}`}
          </span>
        )
      },
    }),
    columnHelper.accessor('updatedAt', {
      header: 'Updated',
      cell: (info) => (
        <span className="text-sm text-gray-500 whitespace-nowrap">
          {relativeTime(info.getValue())}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const item = info.row.original
        return (
          <div className="flex items-center gap-1 justify-end">
            {isEditor && (
              <button
                onClick={() => router.push(`/items/${item.id}?edit=true`)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => handleArchive(item.id, item.title)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="Archive"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      },
    }),
  ]

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  })

  const hasActiveFilters =
    selectedStatuses.length > 0 || selectedPriorities.length > 0 || search.length > 0 || selectedAreas.length > 0

  const clearFilters = () => {
    setSearch('')
    setSelectedStatuses([])
    setSelectedPriorities([])
    setSelectedAreas([])
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Roadmap — List View</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${total} item${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isEditor && (
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </button>
            )}
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            {isEditor && (
              <button
                onClick={() => router.push('/items/new')}
                className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
              className="w-64 rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <MultiSelect
            label="Status"
            options={ALL_STATUSES.map((s) => ({ value: s, label: s }))}
            value={selectedStatuses}
            onChange={setSelectedStatuses}
          />
          <MultiSelect
            label="Priority"
            options={ALL_PRIORITIES.map((p) => ({ value: p, label: p }))}
            value={selectedPriorities}
            onChange={setSelectedPriorities}
          />
          {selectedAreas.length > 0 && (
            <div className="flex items-center gap-1 rounded-md border border-indigo-400 bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
              Filtered by area
              <button
                onClick={() => setSelectedAreas([])}
                className="ml-1 text-indigo-400 hover:text-indigo-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-gray-200">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-gray-200" style={{ width: `${60 + ((i * columns.length + j) % 5) * 8}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="h-8 w-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">No items match your filters</p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ImportCsvDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() =>
          fetchItems({ search, statuses: selectedStatuses, priorities: selectedPriorities, areas: selectedAreas, page })
        }
      />

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="border-t border-gray-200 bg-white px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} &middot; {total} total items
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RoadmapListPage() {
  return (
    <Suspense>
      <RoadmapListPageInner />
    </Suspense>
  )
}
