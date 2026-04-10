'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  BarChart2,
  List,
  Layers,
  Package,
  Globe2,
  UserCog,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Hierarchy types ──────────────────────────────────────────────────────────

interface ProductArea { id: string; name: string; color: string }
interface ProductGroup { id: string; name: string; color: string; areas: ProductArea[] }
interface ProductDomain { id: string; name: string; color: string; groups: ProductGroup[] }

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  user: { name?: string | null; email?: string | null; role?: string | null }
  currentPath: string
  hierarchy: ProductDomain[]
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-purple-500/20 text-purple-300 ring-purple-500/30',
  editor: 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
  viewer: 'bg-slate-500/20 text-slate-400 ring-slate-500/30',
}

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/roadmap/gantt', label: 'Gantt View', icon: BarChart2 },
  { href: '/roadmap/list', label: 'List View', icon: List },
]

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/domains', label: 'Domains', icon: Globe2 },
  { href: '/groups', label: 'Product Groups', icon: Layers },
  { href: '/areas', label: 'Areas', icon: Package },
  { href: '/users', label: 'Users', icon: UserCog },
]

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ─── Hierarchy nodes ──────────────────────────────────────────────────────────

function GroupNode({
  group,
  currentPath,
  forceOpen,
}: {
  group: ProductGroup
  currentPath: string
  forceOpen?: boolean
}) {
  const hasActive = group.areas.some((a) => currentPath.includes(`area=${a.id}`))
  const [open, setOpen] = useState(hasActive)
  const isOpen = forceOpen || open

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
      >
        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
        <span className="flex-1 truncate text-left">{group.name}</span>
        {isOpen
          ? <ChevronDown className="h-3 w-3 flex-shrink-0" />
          : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
      </button>
      {isOpen && group.areas.map((area) => {
        const isActive = currentPath.includes(`area=${area.id}`)
        return (
          <Link
            key={area.id}
            href={`/roadmap/list?area=${area.id}`}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 pl-6 text-xs transition-colors',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: area.color }} />
            <span className="truncate">{area.name}</span>
          </Link>
        )
      })}
    </div>
  )
}

function DomainNode({
  domain,
  collapsed,
  currentPath,
  forceOpen,
}: {
  domain: ProductDomain
  collapsed: boolean
  currentPath: string
  forceOpen?: boolean
}) {
  const hasActive = domain.groups.some((g) =>
    g.areas.some((a) => currentPath.includes(`area=${a.id}`))
  )
  const [open, setOpen] = useState(hasActive)
  const isOpen = forceOpen || open

  if (collapsed) {
    return (
      <button
        title={domain.name}
        className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
      >
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: domain.color }} />
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
      >
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: domain.color }} />
        <span className="flex-1 truncate text-left">{domain.name}</span>
        {isOpen
          ? <ChevronDown className="h-3 w-3 flex-shrink-0" />
          : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
      </button>
      {isOpen && domain.groups.map((group) => (
        <div key={group.id} className="pl-2">
          <GroupNode group={group} currentPath={currentPath} forceOpen={forceOpen} />
        </div>
      ))}
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar({ user, currentPath, hierarchy }: SidebarProps) {
  const role = user.role ?? 'viewer'
  const isAdmin = role === 'admin'

  // All state lives here so it survives collapsed/mobile toggles
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')

  const isSearching = search.trim().length > 0

  const filteredHierarchy = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return hierarchy
    return hierarchy
      .map((domain) => ({
        ...domain,
        groups: domain.groups
          .map((group) => ({
            ...group,
            areas: group.areas.filter((a) => a.name.toLowerCase().includes(q)),
          }))
          .filter(
            (group) =>
              group.areas.length > 0 || group.name.toLowerCase().includes(q)
          ),
      }))
      .filter(
        (domain) =>
          domain.groups.length > 0 || domain.name.toLowerCase().includes(q)
      )
  }, [search, hierarchy])

  function isActive(href: string) {
    return currentPath === href || currentPath.startsWith(href + '/')
  }

  const navLinkClass = (href: string) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
      isActive(href)
        ? 'bg-white/10 text-white shadow-sm'
        : 'text-slate-400 hover:bg-white/5 hover:text-white'
    )

  const navSection = (
    <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
      {/* Main nav */}
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
          <item.icon className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>{item.label}</span>}
        </Link>
      ))}

      {/* Products section */}
      {hierarchy.length > 0 && (
        <>
          <div className={cn('my-3 border-t border-white/10', collapsed && 'mx-1')} />
          {!collapsed && (
            <>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Products
              </p>
              {/* Search within hierarchy */}
              <div className="relative px-1 pb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search domains, groups, areas…"
                  className="w-full rounded-md bg-white/5 pl-6 pr-6 py-1.5 text-xs text-slate-300 placeholder-slate-500 outline-none focus:ring-1 focus:ring-white/20 transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </>
          )}
          {filteredHierarchy.length === 0 && !collapsed && (
            <p className="px-3 py-2 text-xs text-slate-500 italic">No matches</p>
          )}
          {filteredHierarchy.map((domain) => (
            <DomainNode
              key={domain.id}
              domain={domain}
              collapsed={collapsed}
              currentPath={currentPath}
              forceOpen={isSearching || undefined}
            />
          ))}
        </>
      )}

      {/* Admin section */}
      {isAdmin && (
        <>
          <div className={cn('my-3 border-t border-white/10', collapsed && 'mx-1')} />
          {!collapsed && (
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Admin
            </p>
          )}
          {ADMIN_NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </>
      )}
    </nav>
  )

  const userFooter = (
    <div className="border-t border-white/10 p-3">
      {collapsed ? (
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white leading-tight">{user.name ?? 'Unknown'}</p>
              <p className="truncate text-xs text-slate-400 leading-tight">{user.email ?? ''}</p>
            </div>
            <span className={cn('flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ring-1', ROLE_STYLES[role] ?? ROLE_STYLES.viewer)}>
              {role}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )

  const logoBar = (
    <div className="flex h-14 items-center justify-between px-4 border-b border-white/10">
      {!collapsed && (
        <span className="text-base font-bold tracking-tight text-white truncate">TELUS CIO Product Roadmap</span>
      )}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="hidden lg:flex ml-auto h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors flex-shrink-0"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
      <button
        onClick={() => setMobileOpen(false)}
        className="lg:hidden ml-auto h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )

  const sidebarInner = (
    <div className="flex h-full flex-col">
      {logoBar}
      {navSection}
      {userFooter}
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 lg:hidden flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-white shadow-lg"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar drawer */}
      <aside className={cn('fixed inset-y-0 left-0 z-50 w-60 bg-[#1e293b] transition-transform duration-300 lg:hidden', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        {sidebarInner}
      </aside>

      {/* Desktop sidebar */}
      <aside className={cn('hidden lg:flex flex-col h-screen flex-shrink-0 bg-[#1e293b] transition-all duration-300', collapsed ? 'w-[60px]' : 'w-[240px]')}>
        {sidebarInner}
      </aside>
    </>
  )
}
