'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useCallback } from 'react'
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
  X,
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

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  // Close drawer on route change (mobile)
  useEffect(() => {
    onClose()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [mobileOpen])

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (mobileOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileOpen, handleKeyDown])

  const nav = (
    <>
      {/* Logo */}
      <div className="px-5 pt-6 pb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Film size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">
            Feed<span className="text-violet-400">My</span>Potato
          </span>
        </Link>
        {/* Close button – mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          aria-label="Chiudi menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
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
    </>
  )

  return (
    <>
      {/* ── Desktop sidebar (lg+): always visible ── */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 h-screen flex-col border-r border-white/[0.06] bg-[oklch(0.13_0.02_280)]">
        {nav}
      </aside>

      {/* ── Mobile drawer (<lg): overlay + slide-in ── */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-visibility ${
          mobileOpen ? 'visible' : 'invisible'
        }`}
        aria-hidden={!mobileOpen}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onClose}
        />
        {/* Drawer panel */}
        <aside
          className={`absolute left-0 top-0 h-full w-72 flex flex-col bg-[oklch(0.13_0.02_280)] border-r border-white/[0.06] shadow-2xl shadow-black/40 transition-transform duration-300 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {nav}
        </aside>
      </div>
    </>
  )
}
