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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const item = await prisma.roadmapItem.findUnique({
      where: { id },
      include: {
        productArea: true,
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        updatedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        auditLogs: {
          include: {
            changedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { timestamp: 'desc' },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(parseItem(item as unknown as Record<string, unknown>))
  } catch (err) {
    console.error('[GET /api/items/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const existing = await prisma.roadmapItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()

    // Build diff by comparing changed scalar fields
    const trackableFields = [
      'title', 'status', 'priority', 'confidence', 'description',
      'outcome', 'targetQuarterStart', 'targetQuarterEnd',
      'productAreaId', 'labels', 'jiraLinks',
    ] as const

    const diff: Record<string, { before: unknown; after: unknown }> = {}
    for (const field of trackableFields) {
      if (field in body) {
        const before = (existing as unknown as Record<string, unknown>)[field]
        const after = field === 'labels' || field === 'jiraLinks'
          ? JSON.stringify(body[field])
          : body[field]
        if (before !== after) {
          diff[field] = {
            before: field === 'labels' || field === 'jiraLinks'
              ? (() => { try { return JSON.parse(before as string) } catch { return before } })()
              : before,
            after: body[field],
          }
        }
      }
    }

    const updateData: Record<string, unknown> = { updatedById: session.user.id }

    for (const field of trackableFields) {
      if (field in body) {
        updateData[field] = field === 'labels' || field === 'jiraLinks'
          ? JSON.stringify(body[field])
          : body[field]
      }
    }

    const updated = await prisma.roadmapItem.update({
      where: { id },
      data: updateData,
      include: {
        productArea: true,
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        updatedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        entityType: 'RoadmapItem',
        entityId: id,
        entityTitle: updated.title,
        action: 'updated',
        changedById: session.user.id,
        diff: JSON.stringify(diff),
      },
    })

    return NextResponse.json(parseItem(updated as unknown as Record<string, unknown>))
  } catch (err) {
    console.error('[PUT /api/items/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.roadmapItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const archived = await prisma.roadmapItem.update({
      where: { id },
      data: { archivedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        entityType: 'RoadmapItem',
        entityId: id,
        entityTitle: existing.title,
        action: 'archived',
        changedById: session.user.id,
        diff: JSON.stringify({}),
      },
    })

    return NextResponse.json({ success: true, archivedAt: archived.archivedAt })
  } catch (err) {
    console.error('[DELETE /api/items/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
