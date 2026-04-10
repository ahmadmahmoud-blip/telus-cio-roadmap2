import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const groups = await prisma.productGroup.findMany({
      include: {
        domain: { select: { id: true, name: true, color: true } },
        areas: {
          include: {
            items: { where: { archivedAt: null }, select: { id: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const data = groups.map((g) => ({
      ...g,
      areaCount: g.areas.length,
      itemCount: g.areas.reduce((sum, a) => sum + a.items.length, 0),
    }))

    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/groups]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { name, color, domainId } = await request.json()
    if (!name || !domainId) return NextResponse.json({ error: 'Name and domainId are required' }, { status: 400 })

    const group = await prisma.productGroup.create({
      data: { name, color: color ?? '#8b5cf6', domainId },
      include: { domain: { select: { id: true, name: true } } },
    })
    return NextResponse.json(group, { status: 201 })
  } catch (err) {
    console.error('[POST /api/groups]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
