'use client'

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, X, SlidersHorizontal } from 'lucide-react'
import { cn, ALL_STATUSES, ALL_PRIORITIES, PRIORITY_LABELS } from '@/lib/utils'

export interface FilterState {
  statuses: string[]
  priorities: string[]
}

interface FilterBarProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

// ─── Multi-select dropdown ────────────────────────────────────────────────────

interface MultiSelectProps {
  label: string
  options: { value: string; label: string; dot?: string }[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
}

function MultiSelect({ label, options, selected, onToggle, onClear }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const count = selected.length

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
            count > 0
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
          )}
        >
          <span>{label}</span>
          {count > 0 && (
            <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
              {count}
            </span>
          )}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-200/60 outline-none animate-in fade-in-0 zoom-in-95"
        >
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => onToggle(opt.value)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors',
                  isSelected
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                {opt.dot && (
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: opt.dot }}
                  />
                )}
                <span className="flex-1 truncate">{opt.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0 text-indigo-600" />}
              </button>
            )
          })}
          {count > 0 && (
            <div className="mt-1 border-t border-slate-100 pt-1">
              <button
                onClick={onClear}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <X className="h-3 w-3" />
                Clear {label.toLowerCase()}
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ─── Status color dots ────────────────────────────────────────────────────────

const STATUS_DOT_COLORS: Record<string, string> = {
  Discovery: '#3b82f6',
  Planned: '#8b5cf6',
  'In Progress': '#f59e0b',
  Shipped: '#22c55e',
  Blocked: '#ef4444',
  Cancelled: '#9ca3af',
}

const PRIORITY_DOT_COLORS: Record<string, string> = {
  P0: '#ef4444',
  P1: '#f97316',
  P2: '#eab308',
  P3: '#6b7280',
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const totalActive = filters.statuses.length + filters.priorities.length

  function toggleStatus(status: string) {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status]
    onChange({ ...filters, statuses: next })
  }

  function togglePriority(p: string) {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter((x) => x !== p)
      : [...filters.priorities, p]
    onChange({ ...filters, priorities: next })
  }

  function clearAll() {
    onChange({ statuses: [], priorities: [] })
  }

  const statusOptions = ALL_STATUSES.map((s) => ({
    value: s,
    label: s,
    dot: STATUS_DOT_COLORS[s],
  }))

  const priorityOptions = ALL_PRIORITIES.map((p) => ({
    value: p,
    label: `${p} · ${PRIORITY_LABELS[p]}`,
    dot: PRIORITY_DOT_COLORS[p],
  }))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm text-slate-500 mr-1">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="font-medium">Filter:</span>
      </div>

      <MultiSelect
        label="Status"
        options={statusOptions}
        selected={filters.statuses}
        onToggle={toggleStatus}
        onClear={() => onChange({ ...filters, statuses: [] })}
      />

      <MultiSelect
        label="Priority"
        options={priorityOptions}
        selected={filters.priorities}
        onToggle={togglePriority}
        onClear={() => onChange({ ...filters, priorities: [] })}
      />

      {totalActive > 0 && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <X className="h-3 w-3" />
          Clear all ({totalActive})
        </button>
      )}
    </div>
  )
}
