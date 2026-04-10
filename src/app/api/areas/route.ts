import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const areas = await prisma.productArea.findMany({
      include: {
        group: {
          select: { id: true, name: true, domain: { select: { id: true, name: true } } },
        },
        items: {
          where: { archivedAt: null },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const data = areas.map((area) => ({
      ...area,
      itemCount: area.items.length,
    }))

    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/areas]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, color, groupId } = body

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const area = await prisma.productArea.create({
      data: {
        name,
        color: color ?? '#6366f1',
        ...(groupId && { groupId }),
      },
    })

    return NextResponse.json(area, { status: 201 })
  } catch (err) {
    console.error('[POST /api/areas]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
