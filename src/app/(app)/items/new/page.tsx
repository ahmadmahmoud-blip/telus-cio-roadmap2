'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { ItemForm, type ItemFormValues, type Area } from '@/components/items/ItemForm'

export default function NewItemPage() {
  const router = useRouter()
  const [areas, setAreas] = useState<Area[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)

  useEffect(() => {
    fetch('/api/areas')
      .then((r) => r.json())
      .then((areasData) => setAreas(areasData.data ?? areasData))
      .catch(() => toast.error('Failed to load form options'))
      .finally(() => setLoadingOptions(false))
  }, [])

  const labelsToArray = (labels?: string): string[] => {
    if (!labels) return []
    return labels
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)
  }

  const handleSubmit = async (data: ItemFormValues) => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          labels: labelsToArray(data.labels),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to create item')
      }
      const item = await res.json()
      toast.success('Item created successfully')
      router.push(`/items/${item.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitAnother = async (data: ItemFormValues) => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          labels: labelsToArray(data.labels),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to create item')
      }
      toast.success('Item created — form reset for next item')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create item')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      {/* Breadcrumb */}
      <Link
        href="/roadmap/list"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to roadmap
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">New Roadmap Item</h1>
        {loadingOptions ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="mb-1 h-3.5 w-24 rounded bg-gray-200" />
                <div className="h-9 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : (
          <ItemForm
            areas={areas}
            onSubmit={handleSubmit}
            onSubmitAnother={handleSubmitAnother}
            isSubmitting={isSubmitting}
            mode="create"
            onCancel={() => router.push('/roadmap/list')}
          />
        )}
      </div>
    </div>
  )
}
