import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['Discovery', 'Planned', 'In Progress', 'Shipped', 'Blocked', 'Cancelled']
const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3']
const QUARTER_RE = /^\d{4}-Q[1-4]$/

interface ImportRow {
  title: string
  productAreaName: string
  status: string
  priority: string
  targetQuarterStart: string
  targetQuarterEnd: string
}

interface RowError {
  row: number
  reason: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'admin'
    const isEditor = session.user.role === 'editor'
    if (!isAdmin && !isEditor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { items } = body as { items: ImportRow[] }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }
    if (items.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 items per import' }, { status: 400 })
    }

    // Build case-insensitive product area map
    const allAreas = await prisma.productArea.findMany({ select: { id: true, name: true } })
    const areaMap = new Map(allAreas.map((a) => [a.name.toLowerCase(), a.id]))

    const rowErrors: RowError[] = []
    const resolvedRows: Array<ImportRow & { productAreaId: string; rowIndex: number }> = []

    items.forEach((row, i) => {
      const rowIndex = i + 1
      const errors: string[] = []

      if (!row.title?.trim()) errors.push('Title is required')
      if (!row.productAreaName?.trim()) {
        errors.push('Product Area is required')
      } else {
        const areaId = areaMap.get(row.productAreaName.trim().toLowerCase())
        if (!areaId) {
          errors.push(`Product Area "${row.productAreaName}" not found`)
        } else if (!VALID_STATUSES.includes(row.status)) {
          errors.push(`Status "${row.status}" is not valid`)
        } else if (!VALID_PRIORITIES.includes(row.priority)) {
          errors.push(`Priority "${row.priority}" is not valid`)
        } else if (!QUARTER_RE.test(row.targetQuarterStart)) {
          errors.push(`Quarter Start "${row.targetQuarterStart}" is not a valid format`)
        } else if (!QUARTER_RE.test(row.targetQuarterEnd)) {
          errors.push(`Quarter End "${row.targetQuarterEnd}" is not a valid format`)
        } else {
          resolvedRows.push({ ...row, productAreaId: areaId, rowIndex })
          return
        }
      }

      rowErrors.push({ row: rowIndex, reason: errors.join('; ') })
    })

    if (resolvedRows.length === 0) {
      return NextResponse.json(
        { imported: 0, errors: rowErrors },
        { status: rowErrors.length > 0 ? 207 : 400 },
      )
    }

    // Create all valid items in a single transaction
    const created = await prisma.$transaction(
      resolvedRows.map((row) =>
        prisma.roadmapItem.create({
          data: {
            title: row.title.trim(),
            productAreaId: row.productAreaId,
            status: row.status,
            priority: row.priority,
            targetQuarterStart: row.targetQuarterStart,
            targetQuarterEnd: row.targetQuarterEnd,
            confidence: 'TBD',
            labels: '[]',
            jiraLinks: '[]',
            createdById: session.user.id,
            updatedById: session.user.id,
          },
        }),
      ),
    )

    // Write audit logs
    await Promise.all(
      created.map((item) =>
        prisma.auditLog.create({
          data: {
            entityType: 'RoadmapItem',
            entityId: item.id,
            entityTitle: item.title,
            action: 'created',
            changedById: session.user.id,
            diff: '{}',
          },
        }),
      ),
    )

    return NextResponse.json(
      { imported: created.length, errors: rowErrors },
      { status: rowErrors.length > 0 ? 207 : 200 },
    )
  } catch (err) {
    console.error('[POST /api/items/import]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
