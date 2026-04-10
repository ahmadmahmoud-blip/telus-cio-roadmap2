'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { StatusBadge } from '@/components/items/StatusBadge'

interface SearchResult {
  id: string
  title: string
  status: string
  productArea: { name: string; color: string }
}

export function QuickSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/items?search=${encodeURIComponent(q)}&pageSize=6`)
      if (!res.ok) return
      const data = await res.json()
      setResults(data.data ?? [])
      setOpen(true)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(() => fetchResults(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, fetchResults])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  function handleSelect(id: string) {
    setOpen(false)
    setQuery('')
    router.push(`/items/${id}`)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Search roadmap items…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {loading ? (
            <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">
              No items found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul>
              {results.map((item, i) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleSelect(item.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <StatusBadge status={item.status} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">
                        {item.title}
                      </span>
                      <span className="flex items-center gap-1 mt-0.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.productArea?.color }}
                        />
                        <span className="text-xs text-slate-400 truncate">
                          {item.productArea?.name}
                        </span>
                      </span>
                    </span>
                  </button>
                  {i < results.length - 1 && <div className="mx-4 border-t border-slate-50" />}
                </li>
              ))}
              <li className="border-t border-slate-100">
                <button
                  onClick={() => {
                    setOpen(false)
                    router.push(`/roadmap/list?search=${encodeURIComponent(query)}`)
                  }}
                  className="flex w-full items-center justify-center gap-1 px-4 py-2 text-xs text-indigo-600 hover:bg-indigo-50 font-medium transition-colors"
                >
                  <Search className="h-3 w-3" />
                  View all results in List View
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
