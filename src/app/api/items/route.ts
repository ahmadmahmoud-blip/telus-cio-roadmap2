import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseItem(item: Record<string, unknown>) {
  return {
    ...item,
    labels: (() => { try { return JSON.parse(item.labels as string) } catch { return [] } })(),
    jiraLinks: (() => { try { return JSON.parse(item.jiraLinks as string) } catch { return [] } })(),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const areasParam = searchParams.get('areas')
    const statusesParam = searchParams.get('statuses')
    const prioritiesParam = searchParams.get('priorities')
    const search = searchParams.get('search') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const pageSize = Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10))
    const domainParam = searchParams.get('domain')
    const groupParam = searchParams.get('group')
    const areaParam = searchParams.get('area')

    const where: Record<string, unknown> = {
      archivedAt: null,
    }

    if (areasParam) {
      where.productAreaId = { in: areasParam.split(',').map(s => s.trim()).filter(Boolean) }
    }
    if (areaParam) {
      where.productAreaId = { in: areaParam.split(',').map(s => s.trim()).filter(Boolean) }
    }
    if (groupParam) {
      where.productArea = { groupId: { in: groupParam.split(',').map(s => s.trim()).filter(Boolean) } }
    }
    if (domainParam) {
      where.productArea = { group: { domainId: { in: domainParam.split(',').map(s => s.trim()).filter(Boolean) } } }
    }
    if (statusesParam) {
      where.status = { in: statusesParam.split(',').map(s => s.trim()).filter(Boolean) }
    }
    if (prioritiesParam) {
      where.priority = { in: prioritiesParam.split(',').map(s => s.trim()).filter(Boolean) }
    }
    if (search) {
      where.title = { contains: search }
    }

    const [total, items] = await Promise.all([
      prisma.roadmapItem.count({ where }),
      prisma.roadmapItem.findMany({
        where,
        include: {
          productArea: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const data = items.map(item => parseItem(item as unknown as Record<string, unknown>))

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    console.error('[GET /api/items]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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
    const {
      title,
      productAreaId,
      status = 'Discovery',
      priority = 'P2',
      targetQuarterStart,
      targetQuarterEnd,
      confidence = 'TBD',
      description,
      labels = [],
      outcome,
    } = body

    if (!title || !productAreaId || !targetQuarterStart || !targetQuarterEnd) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const item = await prisma.roadmapItem.create({
      data: {
        title,
        productAreaId,
        status,
        priority,
        targetQuarterStart,
        targetQuarterEnd,
        confidence,
        description,
        labels: JSON.stringify(labels),
        outcome,
        createdById: session.user.id,
        updatedById: session.user.id,
      },
      include: {
        productArea: true,
      },
    })

    await prisma.auditLog.create({
      data: {
        entityType: 'RoadmapItem',
        entityId: item.id,
        entityTitle: item.title,
        action: 'created',
        changedById: session.user.id,
        diff: JSON.stringify({}),
      },
    })

    return NextResponse.json(parseItem(item as unknown as Record<string, unknown>), { status: 201 })
  } catch (err) {
    console.error('[POST /api/items]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
