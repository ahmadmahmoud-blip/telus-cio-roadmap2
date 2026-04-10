import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const domains = await prisma.productDomain.findMany({
      include: {
        groups: {
          include: {
            areas: {
              include: {
                items: { where: { archivedAt: null }, select: { id: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const data = domains.map((d) => ({
      ...d,
      groupCount: d.groups.length,
      itemCount: d.groups.reduce(
        (sum, g) => sum + g.areas.reduce((s, a) => s + a.items.length, 0),
        0
      ),
    }))

    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/domains]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { name, color } = await request.json()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const domain = await prisma.productDomain.create({
      data: { name, color: color ?? '#6366f1' },
    })
    return NextResponse.json(domain, { status: 201 })
  } catch (err) {
    console.error('[POST /api/domains]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
