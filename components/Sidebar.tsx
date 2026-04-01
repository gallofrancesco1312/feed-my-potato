'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  Film,
  Tv,
  Download,
  Calendar,
  Clock,
  Globe,
  Settings,
} from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/search', label: 'Cerca', icon: Search },
  { href: '/movies', label: 'Film', icon: Film },
  { href: '/series', label: 'Serie TV', icon: Tv },
  { href: '/downloads', label: 'Download', icon: Download },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/history', label: 'Cronologia', icon: Clock },
  { href: '/indexers', label: 'Indexer', icon: Globe },
]

const bottomLinks = [
  { href: '/system', label: 'Sistema', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-60 flex-shrink-0 h-screen flex flex-col border-r border-white/[0.06] bg-[oklch(0.13_0.02_280)]">
      {/* Logo */}
      <div className="px-5 pt-6 pb-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Film size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">
            Feed<span className="text-violet-400">My</span>Plex
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Menu
        </p>
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative ${
                active
                  ? 'bg-violet-500/15 text-violet-300'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-violet-500 shadow-lg shadow-violet-500/40" />
              )}
              <Icon size={18} className={active ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300 transition-colors'} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-1 border-t border-white/[0.06] pt-3">
        {bottomLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                active
                  ? 'bg-violet-500/15 text-violet-300'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon size={18} className={active ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300 transition-colors'} />
              {label}
            </Link>
          )
        })}
      </div>
    </aside>
  )
}
