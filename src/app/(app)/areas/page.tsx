'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GroupOption {
  id: string
  name: string
  color: string
  domain?: { id: string; name: string }
}

interface Area {
  id: string
  name: string
  color: string
  groupId?: string | null
  group?: GroupOption | null
  itemCount?: number
  _count?: { items: number }
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#6366f1', '#8b5cf6',
  '#ec4899', '#64748b', '#0ea5e9', '#84cc16',
]

function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1.5">Color</p>
      <div className="grid grid-cols-6 gap-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
              value === color ? 'border-gray-800 scale-110' : 'border-transparent',
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-gray-500">Custom:</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-gray-300 p-0.5"
        />
        <span className="text-xs text-gray-400 font-mono">{value}</span>
      </div>
    </div>
  )
}

interface AreaDialogProps {
  area?: Area | null
  groups: GroupOption[]
  onClose: () => void
  onSaved: () => void
}

function AreaDialog({ area, groups, onClose, onSaved }: AreaDialogProps) {
  const [name, setName] = useState(area?.name ?? '')
  const [color, setColor] = useState(area?.color ?? '#6366f1')
  const [groupId, setGroupId] = useState(area?.groupId ?? '')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const url = area ? `/api/areas/${area.id}` : '/api/areas'
      const method = area ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color, groupId: groupId || null }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to save area')
      }
      toast.success(area ? 'Area updated' : 'Area created')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save area')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {area ? 'Edit Area' : 'Add Area'}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Experience"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Group
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">None</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.domain ? `${g.domain.name} / ${g.name}` : g.name}
                </option>
              ))}
            </select>
          </div>
          <ColorPicker value={color} onChange={setColor} />
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AreasPage() {
  const [areas, setAreas] = useState<Area[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editArea, setEditArea] = useState<Area | null>(null)

  const fetchAreas = async () => {
    try {
      const res = await fetch('/api/areas')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAreas(data.data ?? data)
    } catch {
      toast.error('Failed to load areas')
    } finally {
      setLoading(false)
    }
  }

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setGroups(data)
    } catch {
      toast.error('Failed to load groups')
    }
  }

  useEffect(() => {
    fetchAreas()
    fetchGroups()
  }, [])

  const handleDelete = async (area: Area) => {
    const itemCount = area.itemCount ?? area._count?.items ?? 0
    if (itemCount > 0) {
      toast.error(
        `Cannot delete "${area.name}" — it has ${itemCount} item(s). Reassign them first.`,
      )
      return
    }
    if (!confirm(`Delete area "${area.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/areas/${area.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Area deleted')
      fetchAreas()
    } catch {
      toast.error('Failed to delete area')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Product Areas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage product areas and their hierarchy</p>
        </div>
        <button
          onClick={() => { setEditArea(null); setDialogOpen(true) }}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Add Area
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-40 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : areas.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No areas yet. Create your first product area.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Product Group
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Domain
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Items
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {areas.map((area) => (
                <tr key={area.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-8 w-8 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                        style={{ backgroundColor: area.color }}
                      />
                      <span className="font-medium text-gray-900">{area.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {area.group ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: area.group.color }}
                        />
                        <span className="text-gray-600">{area.group.name}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {area.group?.domain?.name ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{area.itemCount ?? area._count?.items ?? 0}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditArea(area); setDialogOpen(true) }}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(area)}
                        disabled={(area.itemCount ?? area._count?.items ?? 0) > 0}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={
                          (area.itemCount ?? area._count?.items ?? 0) > 0
                            ? 'Has items — cannot delete'
                            : 'Delete area'
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dialogOpen && (
        <AreaDialog
          area={editArea}
          groups={groups}
          onClose={() => { setDialogOpen(false); setEditArea(null) }}
          onSaved={fetchAreas}
        />
      )}
    </div>
  )
}
