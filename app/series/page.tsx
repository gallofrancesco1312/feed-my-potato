'use client'
import { useEffect, useState } from 'react'
import { Tv, ChevronDown, ChevronRight, EyeOff, Trash2, AlertTriangle, Languages } from 'lucide-react'
import { toast } from 'sonner'

interface Series {
  id: number
  title: string
  year: number
  monitored: boolean
  statistics: { episodeFileCount: number; episodeCount: number; seasonCount: number }
  images: { coverType: string; remoteUrl: string }[]
}

interface Episode {
  id: number
  episodeFileId: number
  seasonNumber: number
  episodeNumber: number
  title: string
  hasFile: boolean
  monitored: boolean
}

interface BazarrSubtitle {
  name: string
  code2: string
  path: string | null
}

interface BazarrEpisode {
  sonarrEpisodeId: number
  season: number
  episode: number
  subtitles: BazarrSubtitle[]
  missing_subtitles: BazarrSubtitle[]
}

export default function SeriesPage() {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [bazarrEpisodes, setBazarrEpisodes] = useState<BazarrEpisode[]>([])
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [deleteFiles, setDeleteFiles] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchSeries = () =>
      fetch('/api/sonarr/series')
        .then(r => r.json())
        .then(data => {
          if (!cancelled && Array.isArray(data)) setSeries(data)
        })
        .finally(() => { if (!cancelled) setLoading(false) })

    fetchSeries()
    // Re-fetch every 30s to pick up newly imported series
    const interval = setInterval(fetchSeries, 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const toggleExpand = async (id: number) => {
    if (expanded === id) {
      setExpanded(null)
      return
    }
    setExpanded(id)
    const [epData, subData] = await Promise.all([
      fetch(`/api/sonarr/episode?seriesId=${id}`).then(r => r.json()),
      fetch(`/api/bazarr/episodes?seriesId=${id}`).then(r => r.json()).catch(() => []),
    ])
    if (Array.isArray(epData)) setEpisodes(epData)
    if (Array.isArray(subData)) setBazarrEpisodes(subData)
  }

  const unmonitor = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/sonarr/series/${id}`)
      const seriesData = await res.json()
      seriesData.monitored = false
      await fetch(`/api/sonarr/series/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seriesData),
      })
      setSeries(prev => prev.map(s => (s.id === id ? { ...s, monitored: false } : s)))
      toast.success('Monitoraggio disattivato')
    } catch {
      toast.error('Errore durante la disattivazione del monitoraggio')
    }
  }

  const deleteSeries = async (id: number) => {
    const shouldDeleteFiles = deleteFiles
    setConfirmDelete(null)
    try {
      await fetch(`/api/sonarr/series/${id}?deleteFiles=${shouldDeleteFiles}`, { method: 'DELETE' })
      setSeries(prev => prev.filter(s => s.id !== id))
      toast.success(shouldDeleteFiles ? 'Serie e file rimossi' : 'Serie rimossa dalla libreria')
    } catch {
      toast.error('Errore durante la rimozione della serie')
    }
  }

  const deleteEpisodeFile = async (ep: Episode) => {
    try {
      await fetch(`/api/sonarr/episodefile/${ep.episodeFileId}`, { method: 'DELETE' })
      setEpisodes(prev => prev.map(e => e.id === ep.id ? { ...e, hasFile: false } : e))
      if (expanded) {
        setSeries(prev => prev.map(s => s.id === expanded ? {
          ...s,
          statistics: { ...s.statistics, episodeFileCount: Math.max(0, s.statistics.episodeFileCount - 1) },
        } : s))
      }
      toast.success(`S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')} eliminato`)
    } catch {
      toast.error('Errore durante l\'eliminazione dell\'episodio')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-white/[0.04] rounded-lg animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Serie TV</h1>
        <p className="text-sm text-slate-500 mt-1">{series.length} serie in libreria</p>
      </div>

      {series.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <Tv size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Nessuna serie in libreria.</p>
          <p className="text-sm text-slate-600 mt-1">Usa la ricerca per aggiungere serie TV.</p>
        </div>
      )}

      <div className="space-y-3">
        {series.map(s => {
          const poster = s.images.find(i => i.coverType === 'poster')
          const isExpanded = expanded === s.id
          const episodePct = s.statistics.episodeCount > 0
            ? Math.round((s.statistics.episodeFileCount / s.statistics.episodeCount) * 100)
            : 0

          return (
            <div key={s.id} className="glass-card rounded-xl overflow-hidden transition-all duration-200 hover:border-white/[0.1]">
              <div className="flex items-center">
                <button
                  onClick={() => toggleExpand(s.id)}
                  className="flex-1 flex items-center gap-4 p-4 text-left cursor-pointer"
                >
                  {poster ? (
                    <img
                      src={poster.remoteUrl}
                      alt={s.title}
                      className="w-11 h-16 object-cover rounded-lg"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-11 h-16 bg-white/[0.04] rounded-lg flex items-center justify-center">
                      <Tv size={16} className="text-slate-700" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-white truncate">{s.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.year} &middot; {s.statistics.seasonCount} stagioni
                      {!s.monitored && (
                        <span className="ml-2 text-slate-600">(Non monitorata)</span>
                      )}
                    </p>
                    {/* Episode progress bar */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500"
                          style={{ width: `${episodePct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 tabular-nums">
                        {s.statistics.episodeFileCount}/{s.statistics.episodeCount}
                      </span>
                    </div>
                  </div>
                  <span className="text-slate-500 ml-2">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                </button>

                {/* Action buttons */}
                <div className="flex items-center gap-1 pr-4">
                  <button
                    onClick={e => unmonitor(e, s.id)}
                    className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-amber-400 transition-all duration-200 cursor-pointer"
                    title="Disattiva monitoraggio"
                  >
                    <EyeOff size={16} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setConfirmDelete(s.id)
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all duration-200 cursor-pointer"
                    title="Elimina dalla libreria"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Delete confirmation */}
              {confirmDelete === s.id && (
                <div className="border-t border-white/[0.06] p-4 bg-red-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                      <p className="text-sm text-red-300">
                        Sei sicuro? La serie verr&agrave; rimossa da Sonarr. Questa azione &egrave; irreversibile.
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1.5 text-sm rounded-lg bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] transition-colors cursor-pointer"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={() => deleteSeries(s.id)}
                        className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors cursor-pointer"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 ml-7">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deleteFiles}
                        onChange={e => setDeleteFiles(e.target.checked)}
                        className="accent-red-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-slate-300">Elimina anche i file dal disco</span>
                    </label>
                    {deleteFiles && (
                      <p className="text-[11px] text-red-400 mt-1">I file verranno eliminati permanentemente.</p>
                    )}
                  </div>
                </div>
              )}

              {isExpanded && (
                <div className="border-t border-white/[0.06] p-4 space-y-1.5">
                  {episodes.filter(ep => ep.hasFile).length === 0 ? (
                    <p className="text-sm text-slate-600">Nessun episodio scaricato.</p>
                  ) : (
                    episodes.filter(ep => ep.hasFile).map(ep => {
                      const bazarrEp = bazarrEpisodes.find(
                        b => b.season === ep.seasonNumber && b.episode === ep.episodeNumber,
                      )
                      const hasExternalSubs = bazarrEp?.subtitles.some(s => s.path) ?? false
                      const subLangs = bazarrEp?.subtitles
                        .filter(s => s.path)
                        .map(s => s.code2.toUpperCase()) ?? []

                      return (
                        <div key={ep.id} className="flex items-center gap-3 text-sm py-1.5 px-2 -mx-2 rounded-lg group/ep hover:bg-white/[0.04] transition-colors">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                          <span className="text-slate-400 tabular-nums text-xs">
                            S{String(ep.seasonNumber).padStart(2, '0')}E
                            {String(ep.episodeNumber).padStart(2, '0')}
                          </span>
                          {hasExternalSubs ? (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400" title={`Sottotitoli: ${subLangs.join(', ')}`}>
                              <Languages size={12} />
                              {subLangs.join(', ')}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-slate-600" title="Nessun sottotitolo">
                              <Languages size={12} />
                            </span>
                          )}
                          <button
                            onClick={() => deleteEpisodeFile(ep)}
                            className="ml-auto p-1.5 rounded-md hover:bg-red-500/15 text-slate-600 hover:text-red-400 opacity-0 group-hover/ep:opacity-100 transition-all cursor-pointer"
                            title="Elimina file episodio"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
