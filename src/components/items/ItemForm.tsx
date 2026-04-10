'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ALL_STATUSES, ALL_PRIORITIES, ALL_CONFIDENCES, formatQuarter } from '@/lib/utils'

const QUARTER_OPTIONS: string[] = []
for (const year of [2025, 2026, 2027]) {
  for (let q = 1; q <= 4; q++) {
    QUARTER_OPTIONS.push(`${year}-Q${q}`)
  }
}

const itemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  productAreaId: z.string().min(1, 'Product area is required'),
  status: z.string().min(1, 'Status is required'),
  priority: z.string().min(1, 'Priority is required'),
  targetQuarterStart: z.string().min(1, 'Start quarter is required'),
  targetQuarterEnd: z.string().min(1, 'End quarter is required'),
  confidence: z.string().min(1, 'Confidence is required'),
  description: z.string().optional(),
  labels: z.string().optional(),
  outcome: z.string().optional(),
})

export type ItemFormValues = z.infer<typeof itemSchema>

export interface Area {
  id: string
  name: string
  color: string
}

interface ItemFormProps {
  defaultValues?: Partial<ItemFormValues>
  areas: Area[]
  onSubmit: (data: ItemFormValues) => Promise<void>
  onSubmitAnother?: (data: ItemFormValues) => Promise<void>
  isSubmitting: boolean
  mode: 'create' | 'edit'
  onCancel?: () => void
}

export function ItemForm({
  defaultValues,
  areas,
  onSubmit,
  onSubmitAnother,
  isSubmitting,
  mode,
  onCancel,
}: ItemFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      title: '',
      productAreaId: '',
      status: 'Discovery',
      priority: 'P2',
      targetQuarterStart: '2025-Q1',
      targetQuarterEnd: '2025-Q2',
      confidence: 'TBD',
      description: '',
      labels: '',
      outcome: '',
      ...defaultValues,
    },
  })

  const handleSaveAnother = handleSubmit(async (data) => {
    if (onSubmitAnother) {
      await onSubmitAnother(data)
      reset({
        title: '',
        productAreaId: data.productAreaId,
        status: data.status,
        priority: data.priority,
        targetQuarterStart: data.targetQuarterStart,
        targetQuarterEnd: data.targetQuarterEnd,
        confidence: data.confidence,
        description: '',
        labels: '',
        outcome: '',
      })
    }
  })

  const inputClass =
    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const errorClass = 'mt-1 text-xs text-red-600'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Title */}
      <div>
        <label className={labelClass}>
          Title <span className="text-red-500">*</span>
        </label>
        <input
          {...register('title')}
          type="text"
          placeholder="e.g. Launch customer portal v2"
          className={inputClass}
        />
        {errors.title && <p className={errorClass}>{errors.title.message}</p>}
      </div>

      {/* Product Area */}
      <div>
        <label className={labelClass}>
          Product Area <span className="text-red-500">*</span>
        </label>
        <select {...register('productAreaId')} className={inputClass}>
          <option value="">Select area…</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {errors.productAreaId && <p className={errorClass}>{errors.productAreaId.message}</p>}
      </div>

      {/* Status + Priority */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            Status <span className="text-red-500">*</span>
          </label>
          <select {...register('status')} className={inputClass}>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.status && <p className={errorClass}>{errors.status.message}</p>}
        </div>
        <div>
          <label className={labelClass}>
            Priority <span className="text-red-500">*</span>
          </label>
          <select {...register('priority')} className={inputClass}>
            {ALL_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {errors.priority && <p className={errorClass}>{errors.priority.message}</p>}
        </div>
      </div>

      {/* Quarter Start + End */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            Target Quarter Start <span className="text-red-500">*</span>
          </label>
          <select {...register('targetQuarterStart')} className={inputClass}>
            {QUARTER_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {formatQuarter(q)}
              </option>
            ))}
          </select>
          {errors.targetQuarterStart && (
            <p className={errorClass}>{errors.targetQuarterStart.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>
            Target Quarter End <span className="text-red-500">*</span>
          </label>
          <select {...register('targetQuarterEnd')} className={inputClass}>
            {QUARTER_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {formatQuarter(q)}
              </option>
            ))}
          </select>
          {errors.targetQuarterEnd && (
            <p className={errorClass}>{errors.targetQuarterEnd.message}</p>
          )}
        </div>
      </div>

      {/* Confidence */}
      <div>
        <label className={labelClass}>Confidence</label>
        <select {...register('confidence')} className={inputClass}>
          {ALL_CONFIDENCES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {errors.confidence && <p className={errorClass}>{errors.confidence.message}</p>}
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          {...register('description')}
          rows={4}
          placeholder="Describe the initiative, context, and goals…"
          className={inputClass}
        />
      </div>

      {/* Outcome */}
      <div>
        <label className={labelClass}>Outcome</label>
        <input
          {...register('outcome')}
          type="text"
          placeholder="Expected outcome or success metric"
          className={inputClass}
        />
      </div>

      {/* Labels */}
      <div>
        <label className={labelClass}>Labels</label>
        <input
          {...register('labels')}
          type="text"
          placeholder="Comma-separated: frontend, api, auth"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500">Separate multiple labels with commas</p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        {mode === 'create' && onSubmitAnother && (
          <button
            type="button"
            onClick={handleSaveAnother}
            disabled={isSubmitting}
            className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            Save &amp; Add Another
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create Item' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
