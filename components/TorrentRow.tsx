import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Torrent } from '@/lib/qbittorrent'
import {
  getStateConfig,
  BADGE_COLORS,
  formatSize,
  formatDate,
  extractTrackerHost,
} from '@/lib/torrent-utils'

function formatSpeed(bps: number) {
  return bps > 1e6 ? `${(bps / 1e6).toFixed(1)} MB/s` : `${(bps / 1e3).toFixed(0)} KB/s`
}

function formatEta(secs: number) {
  if (secs > 86400 || secs < 0) return '\u221e'
  if (secs > 3600) return `${Math.floor(secs / 3600)}h`
  if (secs > 60) return `${Math.floor(secs / 60)}m`
  return `${secs}s`
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase text-slate-600 tracking-wide">{label}</span>
      <span className="text-xs text-slate-300 font-medium">{value}</span>
    </div>
  )
}

export function TorrentRow({
  torrent,
  onDelete,
  onTogglePause,
  label: labelProp,
}: {
  torrent: Torrent
  onDelete: (hash: string, deleteFiles: boolean) => void
  onTogglePause: (hash: string, paused: boolean) => void
  label?: 'Film' | 'Serie' | null
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const pct = Math.round(torrent.progress * 100)
  const stateConfig = getStateConfig(torrent.state)
  const isPaused = torrent.state === 'pausedDL' || torrent.state === 'pausedUP'

  return (
    <div className="glass-card rounded-xl p-5 space-y-4 transition-all duration-200 hover:border-white/[0.1]">
      {/* Row 1: Name + badges */}
      <div className="flex items-center gap-2">
        <p className="font-medium truncate flex-1 text-white">{torrent.name}</p>
        <Badge className={BADGE_COLORS[stateConfig.color]}>{stateConfig.label}</Badge>
        {labelProp === 'Film' && (
          <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/20">Film</Badge>
        )}
        {labelProp === 'Serie' && (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20">Serie</Badge>
        )}
      </div>

      {/* Row 2: Progress bar + summary */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-violet-400 w-12 text-right tabular-nums">{pct}%</span>
        <span className="text-xs text-slate-500 hidden sm:inline">{formatSize(torrent.total_size || torrent.size)}</span>
        {torrent.dlspeed > 0 && (
          <span className="text-xs text-slate-500 hidden sm:inline">{formatSpeed(torrent.dlspeed)}</span>
        )}
      </div>

      {/* Collapsible details */}
      <button
        onClick={() => setDetailsOpen(!detailsOpen)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
      >
        {detailsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Dettagli
      </button>

      {detailsOpen && (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-4 animate-in fade-in duration-200">
          <MetaItem label="Dimensione" value={formatSize(torrent.total_size || torrent.size)} />
          <MetaItem label="Seed / Peer" value={`${torrent.num_seeds ?? 0} / ${torrent.num_leechs ?? 0}`} />
          <MetaItem label="Ratio" value={(torrent.ratio ?? 0).toFixed(2)} />
          <MetaItem label="Velocità DL" value={formatSpeed(torrent.dlspeed)} />
          <MetaItem label="Velocità UP" value={formatSpeed(torrent.upspeed ?? 0)} />
          <MetaItem label="ETA" value={formatEta(torrent.eta)} />
          <MetaItem label="Aggiunto il" value={formatDate(torrent.added_on ?? 0)} />
          <MetaItem label="Tracker" value={extractTrackerHost(torrent.tracker ?? '')} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={() => onTogglePause(torrent.hash, isPaused)} className="cursor-pointer rounded-lg border-white/[0.1] hover:bg-white/[0.06]">
          {isPaused ? 'Riprendi' : 'Pausa'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDelete(torrent.hash, false)} className="cursor-pointer rounded-lg border-white/[0.1] hover:bg-white/[0.06]">
          Rimuovi
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(torrent.hash, true)} className="cursor-pointer rounded-lg">
          Elimina file
        </Button>
      </div>
    </div>
  )
}
