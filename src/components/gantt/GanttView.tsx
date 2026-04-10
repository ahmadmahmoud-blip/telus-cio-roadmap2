'use client'

import { useState, useMemo } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react'
import {
  STATUS_BAR_COLORS,
  formatQuarter,
  ALL_STATUSES,
  ALL_PRIORITIES,
} from '@/lib/utils'
import { FilterBar, FilterState } from '@/components/filters/FilterBar'
import { StatusBadge } from '@/components/items/StatusBadge'
import { PriorityBadge } from '@/components/items/PriorityBadge'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GanttItem {
  id: string
  title: string
  status: string
  priority: string
  targetQuarterStart: string
  targetQuarterEnd: string
  productArea: {
    id: string
    name: string
    color: string
    group?: { id: string; name: string; color: string; domain?: { id: string; name: string; color: string } } | null
  }
}

type GroupByOption = 'Product Area' | 'Product Group' | 'Domain' | 'Status' | 'None'
type ColorByOption = 'Status' | 'Priority'

interface GanttViewProps {
  items: GanttItem[]
}

// ─── Quarter geometry helpers ─────────────────────────────────────────────────

/**
 * Returns the year and quarter number (1-4) from a quarter string like "2025-Q2".
 */
function parseQuarter(q: string): { year: number; num: number } {
  const [year, qPart] = q.split('-')
  return { year: parseInt(year, 10), num: parseInt(qPart.replace('Q', ''), 10) }
}

/**
 * Given a quarter string and a display year, returns left% and width% [0,100]
 * for the bar within the year's 4-column grid.
 * Returns null if the quarter is entirely outside the year.
 */
function quarterGeometry(
  startQ: string,
  endQ: string,
  year: number
): { left: number; width: number } | null {
  const start = parseQuarter(startQ)
  const end = parseQuarter(endQ)

  // Each quarter = 25% of the row. We work in units of 25%.
  // The display year spans Q1(0) → Q4-end(100).
  // startFraction: fraction from year start to item start quarter start.
  // endFraction: fraction from year start to item end quarter end.

  const yearStartFraction = 0
  const yearEndFraction = 100

  // Item start in fraction (start of that quarter)
  function qToFraction(y: number, q: number, isEnd: boolean): number {
    // isEnd means we take the END of that quarter (q+1 start)
    const quarterIdx = isEnd ? q : q - 1 // 0-indexed if start, q if end
    return ((y - year) * 4 + quarterIdx) * 25
  }

  const itemLeft = qToFraction(start.year, start.num, false)
  const itemRight = qToFraction(end.year, end.num, true)

  // Clamp to the year [0, 100]
  const clampedLeft = Math.max(yearStartFraction, itemLeft)
  const clampedRight = Math.min(yearEndFraction, itemRight)

  if (clampedLeft >= yearEndFraction || clampedRight <= yearStartFraction) return null

  return {
    left: clampedLeft,
    width: clampedRight - clampedLeft,
  }
}

// ─── Today marker position ────────────────────────────────────────────────────

function todayPosition(year: number): number | null {
  const now = new Date()
  if (now.getFullYear() !== year) return null
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(year, 0, 0).getTime()) / 86400000
  )
  const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365
  return (dayOfYear / daysInYear) * 100
}

// ─── Bar color ────────────────────────────────────────────────────────────────

function barColor(item: GanttItem, colorBy: ColorByOption): string {
  if (colorBy === 'Status') return STATUS_BAR_COLORS[item.status] ?? '#94a3b8'
  // Priority — extract hex from tailwind class (use a lookup)
  const PRIORITY_HEX: Record<string, string> = {
    P0: '#ef4444',
    P1: '#f97316',
    P2: '#eab308',
    P3: '#6b7280',
  }
  return PRIORITY_HEX[item.priority] ?? '#94a3b8'
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

function groupItems(
  items: GanttItem[],
  groupBy: GroupByOption
): { key: string; label: string; color: string; items: GanttItem[] }[] {
  if (groupBy === 'None') {
    return [{ key: 'all', label: 'All Items', color: '#6366f1', items }]
  }

  const map = new Map<string, { label: string; color: string; items: GanttItem[] }>()

  for (const item of items) {
    let key: string
    let label: string
    let color: string

    if (groupBy === 'Product Area') {
      key = item.productArea.id
      label = item.productArea.name
      color = item.productArea.color
    } else if (groupBy === 'Product Group') {
      key = item.productArea.group?.id ?? 'ungrouped'
      label = item.productArea.group?.name ?? 'Ungrouped'
      color = item.productArea.group?.color ?? '#94a3b8'
    } else if (groupBy === 'Domain') {
      key = item.productArea.group?.domain?.id ?? 'ungrouped'
      label = item.productArea.group?.domain?.name ?? 'Ungrouped'
      color = item.productArea.group?.domain?.color ?? '#94a3b8'
    } else {
      // Status
      key = item.status
      label = item.status
      color = STATUS_BAR_COLORS[item.status] ?? '#94a3b8'
    }

    if (!map.has(key)) {
      map.set(key, { label, color, items: [] })
    }
    map.get(key)!.items.push(item)
  }

  return Array.from(map.entries()).map(([key, val]) => ({ key, ...val }))
}

// ─── Quarter header config ────────────────────────────────────────────────────

const QUARTERS = [
  { label: 'Q1', months: 'Jan · Feb · Mar' },
  { label: 'Q2', months: 'Apr · May · Jun' },
  { label: 'Q3', months: 'Jul · Aug · Sep' },
  { label: 'Q4', months: 'Oct · Nov · Dec' },
]

// ─── Bar Popover ──────────────────────────────────────────────────────────────

function BarPopover({ item, color, left, width }: {
  item: GanttItem
  color: string
  left: number
  width: number
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <div
          className="gantt-bar absolute top-1/2 -translate-y-1/2 cursor-pointer rounded"
          style={{
            left: `${left}%`,
            width: `max(30px, ${width}%)`,
            height: 28,
            backgroundColor: color,
            opacity: 0.9,
          }}
          title={item.title}
        >
          <span className="absolute inset-0 flex items-center px-2 overflow-hidden">
            <span className="truncate text-[11px] font-medium text-white leading-none">
              {item.title}
            </span>
          </span>
        </div>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={8}
          className="z-50 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-200/80 outline-none animate-in fade-in-0 zoom-in-95"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Popover.Arrow className="fill-slate-200" />
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-tight">{item.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Status</p>
                <StatusBadge status={item.status} className="mt-0.5" />
              </div>
              <div>
                <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Priority</p>
                <PriorityBadge priority={item.priority} className="mt-0.5" />
              </div>
              <div className="col-span-2">
                <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Product Area</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.productArea.color }}
                  />
                  <span className="text-slate-700">{item.productArea.name}</span>
                </div>
              </div>
              <div className="col-span-2">
                <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Quarter Range</p>
                <p className="mt-0.5 text-slate-700">
                  {formatQuarter(item.targetQuarterStart)}
                  {item.targetQuarterStart !== item.targetQuarterEnd && (
                    <> → {formatQuarter(item.targetQuarterEnd)}</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ─── Swimlane Group ───────────────────────────────────────────────────────────

function SwimLane({
  groupKey: _groupKey,
  label,
  color,
  items,
  year,
  colorBy,
  todayPct,
}: {
  groupKey: string
  label: string
  color: string
  items: GanttItem[]
  year: number
  colorBy: ColorByOption
  todayPct: number | null
}) {
  const [collapsed, setCollapsed] = useState(false)
  const TITLE_COL = 280

  return (
    <div>
      {/* Group header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-left hover:bg-slate-100 transition-colors"
      >
        <span
          className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
          style={{ backgroundColor: color }}
        />
        <span className="flex-1 text-xs font-semibold text-slate-700 uppercase tracking-wide">
          {label}
        </span>
        <span className="text-xs text-slate-400">{items.length} items</span>
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        )}
      </button>

      {/* Rows */}
      {!collapsed && items.map((item) => {
        const geo = quarterGeometry(item.targetQuarterStart, item.targetQuarterEnd, year)
        const bc = barColor(item, colorBy)

        return (
          <div
            key={item.id}
            className="flex border-b border-slate-100 hover:bg-blue-50/30 transition-colors min-h-[44px]"
          >
            {/* Sticky title column */}
            <div
              className="flex items-center flex-shrink-0 border-r border-slate-200 bg-white px-4 py-2 sticky left-0 z-10"
              style={{ width: TITLE_COL }}
            >
              <span className="text-xs text-slate-700 leading-snug line-clamp-2">{item.title}</span>
            </div>

            {/* Timeline area */}
            <div className="relative flex-1 min-w-0">
              {/* Quarter grid lines */}
              {[25, 50, 75].map((pos) => (
                <div
                  key={pos}
                  className="absolute inset-y-0 w-px bg-slate-100"
                  style={{ left: `${pos}%` }}
                />
              ))}

              {/* Today marker */}
              {todayPct !== null && (
                <div
                  className="absolute inset-y-0 w-px bg-red-400/70 z-20"
                  style={{ left: `${todayPct}%` }}
                />
              )}

              {/* Bar */}
              {geo && (
                <BarPopover
                  item={item}
                  color={bc}
                  left={geo.left}
                  width={geo.width}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── GanttView ────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
const TITLE_COL = 280

export function GanttView({ items }: GanttViewProps) {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [groupBy, setGroupBy] = useState<GroupByOption>('Product Area')
  const [colorBy, setColorBy] = useState<ColorByOption>('Status')
  const [filters, setFilters] = useState<FilterState>({
    statuses: [],
    priorities: [],
  })

  const todayPct = todayPosition(year)

  // Apply client-side filters
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filters.statuses.length > 0 && !filters.statuses.includes(item.status)) return false
      if (filters.priorities.length > 0 && !filters.priorities.includes(item.priority)) return false
      return true
    })
  }, [items, filters])

  // Filter to only items visible in the selected year
  const visibleItems = useMemo(() => {
    return filteredItems.filter((item) => {
      const geo = quarterGeometry(item.targetQuarterStart, item.targetQuarterEnd, year)
      return geo !== null
    })
  }, [filteredItems, year])

  const groups = useMemo(
    () => groupItems(visibleItems, groupBy),
    [visibleItems, groupBy]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-6 py-3 sticky top-0 z-30">
        {/* Year stepper */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm transition-all"
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 text-sm font-semibold text-slate-800">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm transition-all"
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Group by */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Group by</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          >
            {(['Product Area', 'Product Group', 'Domain', 'Status', 'None'] as GroupByOption[]).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Color by */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Color by</label>
          <select
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value as ColorByOption)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          >
            {(['Status', 'Priority'] as ColorByOption[]).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Item count */}
        <span className="text-xs text-slate-400">
          {visibleItems.length} of {items.length} items
        </span>
      </div>

      {/* Filter bar */}
      <div className="border-b border-slate-100 bg-white px-6 py-2.5">
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* Timeline */}
      <div className="gantt-scroll flex-1 overflow-x-auto">
        <div style={{ minWidth: 900 }}>
          {/* Sticky header row */}
          <div className="flex sticky top-0 z-20 border-b-2 border-slate-200 bg-white shadow-sm">
            {/* Title column label */}
            <div
              className="flex-shrink-0 border-r border-slate-200 bg-white px-4 py-2.5 sticky left-0 z-30"
              style={{ width: TITLE_COL }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Item
              </span>
            </div>

            {/* Quarter columns */}
            <div className="flex flex-1">
              {QUARTERS.map((q) => (
                <div
                  key={q.label}
                  className="flex-1 border-r border-slate-100 last:border-r-0 px-3 py-2"
                >
                  <p className="text-xs font-bold text-slate-700">{q.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{q.months}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Swimlanes */}
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm font-medium text-slate-500">No items visible for {year}</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting the year or clearing filters.</p>
            </div>
          ) : (
            groups.map((group) => (
              <SwimLane
                key={group.key}
                groupKey={group.key}
                label={group.label}
                color={group.color}
                items={group.items}
                year={year}
                colorBy={colorBy}
                todayPct={todayPct}
              />
            ))
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-slate-100 bg-white px-6 py-2.5 flex items-center gap-6 flex-wrap">
        <span className="text-xs font-medium text-slate-400">Color: {colorBy}</span>
        {colorBy === 'Status' && ALL_STATUSES.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_BAR_COLORS[s] }} />
            <span className="text-xs text-slate-600">{s}</span>
          </div>
        ))}
        {colorBy === 'Priority' && ALL_PRIORITIES.map((p) => {
          const PRIORITY_HEX: Record<string, string> = {
            P0: '#ef4444', P1: '#f97316', P2: '#eab308', P3: '#6b7280',
          }
          return (
            <div key={p} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PRIORITY_HEX[p] }} />
              <span className="text-xs text-slate-600">{p}</span>
            </div>
          )
        })}
        {todayPct !== null && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="h-3 w-px bg-red-400" />
            <span className="text-xs text-slate-400">Today</span>
          </div>
        )}
      </div>
    </div>
  )
}
