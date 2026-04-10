import { prisma } from '@/lib/prisma'
import { GanttView, GanttItem } from '@/components/gantt/GanttView'

export const metadata = {
  title: 'Gantt View | TELUS CIO Product Roadmap',
}

async function getGanttData() {
  const items = await prisma.roadmapItem.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      targetQuarterStart: true,
      targetQuarterEnd: true,
      productArea: {
        select: {
          id: true,
          name: true,
          color: true,
          group: {
            select: {
              id: true,
              name: true,
              color: true,
              domain: { select: { id: true, name: true, color: true } },
            },
          },
        },
      },
    },
    orderBy: [{ targetQuarterStart: 'asc' }, { title: 'asc' }],
  })

  return { items: items as GanttItem[] }
}

export default async function GanttPage() {
  const { items } = await getGanttData()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Gantt View</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Timeline view of all roadmap items across quarters.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <GanttView items={items} />
      </div>
    </div>
  )
}
