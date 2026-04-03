'use client'
import Link from 'next/link'
import { Menu, Film } from 'lucide-react'

interface MobileHeaderProps {
  onMenuToggle: () => void
}

export function MobileHeader({ onMenuToggle }: MobileHeaderProps) {
  return (
    <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] bg-[oklch(0.12_0.015_280/85%)] backdrop-blur-xl">
      <button
        onClick={onMenuToggle}
        className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
        aria-label="Apri menu"
      >
        <Menu size={22} />
      </button>
      <Link href="/" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Film size={13} className="text-white" />
        </div>
        <span className="font-bold text-base tracking-tight text-white">
          Feed<span className="text-violet-400">My</span>Potato
        </span>
      </Link>
    </header>
  )
}
