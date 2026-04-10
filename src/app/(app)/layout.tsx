import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Sidebar } from '@/components/layout/Sidebar'
import { AIChatbot } from '@/components/dashboard/AIChatbot'
import { prisma } from '@/lib/prisma'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  // Next.js 15: headers() is async
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  const hierarchy = await prisma.productDomain.findMany({
    include: {
      groups: {
        include: { areas: { orderBy: { name: 'asc' } } },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          role: (session.user as { role?: string }).role,
        }}
        currentPath={pathname}
        hierarchy={hierarchy}
      />
      <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
      <AIChatbot />
    </div>
  )
}
