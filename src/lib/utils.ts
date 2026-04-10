import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatQuarter(q: string): string {
  // "2025-Q2" → "Q2 2025"
  const [year, quarter] = q.split('-')
  return `${quarter} ${year}`
}

export function quarterToDate(q: string): Date {
  const [year, quarter] = q.split('-')
  const quarterNum = parseInt(quarter.replace('Q', ''))
  const month = (quarterNum - 1) * 3
  return new Date(parseInt(year), month, 1)
}

export function dateToQuarter(date: Date): string {
  const year = date.getFullYear()
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `${year}-Q${quarter}`
}

export const STATUS_COLORS: Record<string, string> = {
  Discovery: 'bg-blue-100 text-blue-700 border-blue-200',
  Planned: 'bg-purple-100 text-purple-700 border-purple-200',
  'In Progress': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Shipped: 'bg-green-100 text-green-700 border-green-200',
  Blocked: 'bg-red-100 text-red-700 border-red-200',
  Cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

export const STATUS_BAR_COLORS: Record<string, string> = {
  Discovery: '#3b82f6',
  Planned: '#8b5cf6',
  'In Progress': '#f59e0b',
  Shipped: '#22c55e',
  Blocked: '#ef4444',
  Cancelled: '#9ca3af',
}

export const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-100 text-red-700 border-red-200',
  P1: 'bg-orange-100 text-orange-700 border-orange-200',
  P2: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  P3: 'bg-gray-100 text-gray-500 border-gray-200',
}

export const PRIORITY_LABELS: Record<string, string> = {
  P0: 'Critical',
  P1: 'High',
  P2: 'Medium',
  P3: 'Low',
}

export const ALL_STATUSES = ['Discovery', 'Planned', 'In Progress', 'Shipped', 'Blocked', 'Cancelled']
export const ALL_PRIORITIES = ['P0', 'P1', 'P2', 'P3']
export const ALL_CONFIDENCES = ['High', 'Medium', 'Low', 'TBD']

export function parseLabels(labels: string): string[] {
  try { return JSON.parse(labels) } catch { return [] }
}

export function serializeLabels(labels: string[]): string {
  return JSON.stringify(labels)
}

export function relativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}
