import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const entityId = searchParams.get('entityId') ?? undefined
    const entityType = searchParams.get('entityType') ?? undefined
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const pageSize = Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10))

    const where: Record<string, unknown> = {}

    if (entityId) where.entityId = entityId
    if (entityType) where.entityType = entityType

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          changedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    // Parse the diff JSON strings for readability
    const data = logs.map(log => ({
      ...log,
      diff: (() => { try { return JSON.parse(log.diff) } catch { return {} } })(),
    }))

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    console.error('[GET /api/audit]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
