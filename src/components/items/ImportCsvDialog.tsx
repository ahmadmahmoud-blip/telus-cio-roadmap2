'use client'

import { useRef, useState } from 'react'
import { Upload, CheckCircle, XCircle, FileText } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ALL_STATUSES, ALL_PRIORITIES } from '@/lib/utils'

interface ImportCsvDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

type Phase = 'idle' | 'reviewing' | 'importing'

interface ParsedRow {
  index: number
  title: string
  productAreaName: string
  status: string
  priority: string
  targetQuarterStart: string
  targetQuarterEnd: string
  valid: boolean
  errors: string[]
}

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  return lines.map((line) => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    cells.push(current.trim())
    return cells
  })
}

function normalizeQuarter(raw: string): string | null {
  const trimmed = raw.trim()
  if (/^\d{4}-Q[1-4]$/.test(trimmed)) return trimmed
  const match = trimmed.match(/^Q([1-4])\s+(\d{4})$/)
  if (match) return `${match[2]}-Q${match[1]}`
  return null
}

function formatQuarterDisplay(q: string): string {
  const match = q.match(/^(\d{4})-Q([1-4])$/)
  if (match) return `Q${match[2]} ${match[1]}`
  return q
}

function validateRow(raw: Record<string, string>, index: number): ParsedRow {
  const errors: string[] = []

  const title = raw['Title']?.trim() ?? ''
  if (!title) errors.push('Title is required')

  const productAreaName = raw['Product Area']?.trim() ?? ''
  if (!productAreaName) errors.push('Product Area is required')

  const rawStatus = raw['Status']?.trim() ?? ''
  const status = rawStatus || 'Discovery'
  if (rawStatus && !ALL_STATUSES.includes(rawStatus)) {
    errors.push(`Status "${rawStatus}" is not valid`)
  }

  const rawPriority = raw['Priority']?.trim() ?? ''
  const priority = rawPriority || 'P2'
  if (rawPriority && !ALL_PRIORITIES.includes(rawPriority)) {
    errors.push(`Priority "${rawPriority}" is not valid`)
  }

  const rawStart = raw['Quarter Start']?.trim() ?? ''
  const targetQuarterStart = normalizeQuarter(rawStart)
  if (!targetQuarterStart) {
    errors.push(`Quarter Start "${rawStart}" must be like Q1 2025 or 2025-Q1`)
  }

  const rawEnd = raw['Quarter End']?.trim() ?? ''
  const targetQuarterEnd = normalizeQuarter(rawEnd)
  if (!targetQuarterEnd) {
    errors.push(`Quarter End "${rawEnd}" must be like Q1 2025 or 2025-Q1`)
  }

  return {
    index,
    title,
    productAreaName,
    status,
    priority,
    targetQuarterStart: targetQuarterStart ?? '',
    targetQuarterEnd: targetQuarterEnd ?? '',
    valid: errors.length === 0,
    errors,
  }
}

export function ImportCsvDialog({ open, onOpenChange, onImported }: ImportCsvDialogProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validCount = parsedRows.filter((r) => r.valid).length
  const invalidCount = parsedRows.length - validCount

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPhase('idle')
      setParsedRows([])
    }
    onOpenChange(nextOpen)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const text = await file.text()
    const rows = parseCsv(text)

    if (rows.length < 2) {
      toast.error('CSV file is empty or has no data rows')
      return
    }

    const headers = rows[0].map((h) => h.trim())
    const dataRows = rows.slice(1)
    const parsed = dataRows.map((cells, i) => {
      const raw: Record<string, string> = {}
      headers.forEach((h, j) => {
        raw[h] = cells[j] ?? ''
      })
      return validateRow(raw, i + 1)
    })

    setParsedRows(parsed)
    setPhase('reviewing')
  }

  const handleImport = async () => {
    setPhase('importing')
    const validRows = parsedRows
      .filter((r) => r.valid)
      .map((r) => ({
        title: r.title,
        productAreaName: r.productAreaName,
        status: r.status,
        priority: r.priority,
        targetQuarterStart: r.targetQuarterStart,
        targetQuarterEnd: r.targetQuarterEnd,
      }))

    try {
      const res = await fetch('/api/items/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: validRows }),
      })
      const data = await res.json()

      if (!res.ok && res.status !== 207) {
        throw new Error(data.error ?? 'Import failed')
      }

      if (data.errors?.length > 0) {
        toast.warning(
          `${data.imported} item${data.imported === 1 ? '' : 's'} imported. ${data.errors.length} failed (product area not found).`,
        )
      } else {
        toast.success(`${data.imported} item${data.imported === 1 ? '' : 's'} imported successfully`)
      }

      onImported()
      onOpenChange(false)
      setPhase('idle')
      setParsedRows([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
      setPhase('reviewing')
    }
  }

  const handleBack = () => {
    setPhase('idle')
    setParsedRows([])
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-lg font-semibold text-gray-900">Import CSV</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {phase === 'idle' && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 px-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
                <FileText className="h-7 w-7 text-indigo-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">Select a CSV file to import</p>
                <p className="mt-1 text-xs text-gray-500">
                  Expected columns: Title, Product Area, Status, Priority, Quarter Start, Quarter End
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Quarter format: Q1 2025 or 2025-Q1 &middot; Status and Priority can be left blank (defaults apply)
                </p>
              </div>
            </div>
          )}

          {(phase === 'reviewing' || phase === 'importing') && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Summary bar */}
              <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
                <span className="text-sm text-gray-600">
                  <span className="font-semibold text-green-700">{validCount} valid</span>
                  {invalidCount > 0 && (
                    <>
                      {' '}
                      &middot;{' '}
                      <span className="font-semibold text-red-600">{invalidCount} invalid</span>
                    </>
                  )}
                  <span className="text-gray-400"> &middot; {parsedRows.length} total rows</span>
                </span>
                {invalidCount > 0 && (
                  <span className="text-xs text-gray-500">
                    Invalid rows will be skipped.
                  </span>
                )}
              </div>

              {/* Review table */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-10">#</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Product Area</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Priority</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Quarter</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.index}
                        className={row.valid ? 'hover:bg-gray-50' : 'bg-red-50 hover:bg-red-100'}
                      >
                        <td className="px-4 py-2.5 text-xs text-gray-400">{row.index}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-900 max-w-[220px] truncate">
                          {row.title || <span className="text-red-400 italic">missing</span>}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">
                          {row.productAreaName || <span className="text-red-400 italic">missing</span>}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{row.status}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{row.priority}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                          {row.targetQuarterStart
                            ? formatQuarterDisplay(row.targetQuarterStart) === formatQuarterDisplay(row.targetQuarterEnd)
                              ? formatQuarterDisplay(row.targetQuarterStart)
                              : `${formatQuarterDisplay(row.targetQuarterStart)} → ${formatQuarterDisplay(row.targetQuarterEnd)}`
                            : <span className="text-red-400 italic">invalid</span>
                          }
                        </td>
                        <td className="px-4 py-2.5">
                          {row.valid ? (
                            <CheckCircle className="h-4 w-4 text-green-500" title="Valid" />
                          ) : (
                            <span title={row.errors.join('; ')}>
                              <XCircle className="h-4 w-4 text-red-500 cursor-help" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
          {phase === 'idle' && (
            <>
              <p className="text-xs text-gray-400">
                You can import items exported from this tool or any CSV matching the expected format.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Upload className="h-4 w-4" />
                Select CSV file
              </button>
            </>
          )}

          {(phase === 'reviewing' || phase === 'importing') && (
            <>
              <button
                onClick={handleBack}
                disabled={phase === 'importing'}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                {invalidCount > 0 && (
                  <span className="text-xs text-gray-500">{invalidCount} invalid row{invalidCount === 1 ? '' : 's'} will be skipped</span>
                )}
                <button
                  onClick={handleImport}
                  disabled={validCount === 0 || phase === 'importing'}
                  className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {phase === 'importing' ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Importing…
                    </>
                  ) : (
                    `Import ${validCount} item${validCount === 1 ? '' : 's'}`
                  )}
                </button>
              </div>
            </>
          )}
        </DialogFooter>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </DialogContent>
    </Dialog>
  )
}
