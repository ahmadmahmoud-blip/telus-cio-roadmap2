'use client'

import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface PriorityBadgeProps {
  priority: string
  showLabel?: boolean
  className?: string
}

export function PriorityBadge({ priority, showLabel = true, className }: PriorityBadgeProps) {
  const colorClass = PRIORITY_COLORS[priority] ?? 'bg-gray-100 text-gray-500 border-gray-200'
  const label = PRIORITY_LABELS[priority] ?? priority
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        colorClass,
        className,
      )}
    >
      {priority}{showLabel && label ? ` · ${label}` : ''}
    </span>
  )
}
