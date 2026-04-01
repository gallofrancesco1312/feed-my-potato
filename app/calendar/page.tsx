'use client'
import { useEffect, useState } from 'react'
import { Calendar, Film, Tv, Download, CheckCircle, XCircle, Trash2, FileEdit, Clock } from 'lucide-react'

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

export default function CalendarPage() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = '?pageSize=100&sortDirection=descending&sortKey=date'
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
        setItems(all)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-white/[0.04] rounded-lg animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl h-14 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // Group by day
  const grouped = items.reduce<Record<string, HistoryItem[]>>((acc, item) => {
    const day = new Date(item.date).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    if (!acc[day]) acc[day] = []
    acc[day].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Calendario</h1>
        <p className="text-sm text-slate-500 mt-1">Cronologia download per data</p>
      </div>

      {items.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <Calendar size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Nessuna attività registrata.</p>
        </div>
      )}

      <div className="space-y-8">
        {Object.entries(grouped).map(([day, dayItems]) => (
          <div key={day}>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 capitalize">
              {day}
            </h2>
            <div className="space-y-2">
              {dayItems.map((item, i) => {
                const IconComp = EVENT_ICONS[item.eventType] ?? Clock
                const colorClass = EVENT_COLORS[item.eventType] ?? 'text-slate-400 bg-white/[0.06]'
                const time = new Date(item.date).toLocaleTimeString('it-IT', {
                  hour: '2-digit',
                  minute: '2-digit',
                })

                return (
                  <div
                    key={i}
                    className="glass-card rounded-xl p-4 flex items-center gap-4 transition-all duration-200 hover:border-white/[0.1]"
                  >
                    {/* Event icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClass}`}>
                      <IconComp size={16} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.sourceTitle}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-600 tabular-nums">{time}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          item.type === 'movie'
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-emerald-500/15 text-emerald-400'
                        }`}>
                          {item.type === 'movie' ? 'Film' : 'Serie'}
                        </span>
                        {item.quality?.quality?.name && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/[0.06] text-slate-500">
                            {item.quality.quality.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Event label */}
                    <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${colorClass}`}>
                      {EVENT_LABELS[item.eventType] ?? item.eventType}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
