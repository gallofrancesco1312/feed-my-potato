'use client'
import { useEffect, useState } from 'react'
import { Clock, Download, CheckCircle, XCircle, FileEdit, Trash2 } from 'lucide-react'

interface HistoryItem {
  date: string
  eventType: string
  sourceTitle: string
  quality?: { quality: { name: string } }
  type: 'movie' | 'series'
}

const EVENT_LABELS: Record<string, string> = {
  grabbed: 'Scaricamento',
  downloadFolderImported: 'Importato',
  downloadFailed: 'Fallito',
  movieFileDeleted: 'Eliminato',
  episodeFileDeleted: 'Eliminato',
  movieFileRenamed: 'Rinominato',
  episodeFileRenamed: 'Rinominato',
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  grabbed: Download,
  downloadFolderImported: CheckCircle,
  downloadFailed: XCircle,
  movieFileDeleted: Trash2,
  episodeFileDeleted: Trash2,
  movieFileRenamed: FileEdit,
  episodeFileRenamed: FileEdit,
}

const EVENT_COLORS: Record<string, string> = {
  grabbed: 'text-violet-400 bg-violet-500/15',
  downloadFolderImported: 'text-emerald-400 bg-emerald-500/15',
  downloadFailed: 'text-red-400 bg-red-500/15',
  movieFileDeleted: 'text-red-400 bg-red-500/15',
  episodeFileDeleted: 'text-red-400 bg-red-500/15',
  movieFileRenamed: 'text-amber-400 bg-amber-500/15',
  episodeFileRenamed: 'text-amber-400 bg-amber-500/15',
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = '?pageSize=50&sortDirection=descending&sortKey=date'
    Promise.all([
      fetch(`/api/radarr/history${params}`)
        .then(r => r.json())
        .then(d =>
          (d?.records ?? []).map((r: HistoryItem) => ({ ...r, type: 'movie' as const })),
        )
        .catch(() => []),
      fetch(`/api/sonarr/history${params}`)
        .then(r => r.json())
        .then(d =>
          (d?.records ?? []).map((r: HistoryItem) => ({ ...r, type: 'series' as const })),
        )
        .catch(() => []),
    ])
      .then(([movies, series]) => {
        const all = [...movies, ...series].sort(
          (a: HistoryItem, b: HistoryItem) =>
            new Date(b.date).getTime() - new Date(a.date).getTime(),
        )
        setItems(all.slice(0, 50))
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-white/[0.04] rounded-lg animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Cronologia</h1>
        <p className="text-sm text-slate-500 mt-1">Attivit&agrave; recente della libreria</p>
      </div>

      {items.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <Clock size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Nessuna attivit&agrave; recente.</p>
        </div>
      )}

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Evento</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Titolo</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Qualit&agrave;</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const IconComp = EVENT_ICONS[item.eventType] ?? Clock
                const colorClass = EVENT_COLORS[item.eventType] ?? 'text-slate-400 bg-white/[0.06]'
                return (
                  <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 text-sm text-slate-400 whitespace-nowrap tabular-nums">
                      {new Date(item.date).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          item.type === 'movie'
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-emerald-500/15 text-emerald-400'
                        }`}
                      >
                        {item.type === 'movie' ? 'Film' : 'Serie'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center ${colorClass}`}>
                          <IconComp size={12} />
                        </span>
                        <span className="text-sm text-slate-300">
                          {EVENT_LABELS[item.eventType] ?? item.eventType}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-300 max-w-[300px] truncate">{item.sourceTitle}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">
                      {item.quality?.quality?.name && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400">
                          {item.quality.quality.name}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
