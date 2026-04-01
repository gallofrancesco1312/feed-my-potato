'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ReleaseTable, type Release } from '@/components/ReleaseTable'

interface Episode {
  id: number
  episodeNumber: number
  seasonNumber: number
  title: string
  airDateUtc?: string
  hasFile: boolean
}

interface EpisodeListProps {
  seriesId: number
}

export function EpisodeList({ seriesId }: EpisodeListProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedSeasons, setCollapsedSeasons] = useState<Set<number>>(new Set())
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<number | null>(null)
  const [releases, setReleases] = useState<Release[]>([])
  const [loadingReleases, setLoadingReleases] = useState(false)

  useEffect(() => {
    fetch(`/api/sonarr/episode?seriesId=${seriesId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setEpisodes(data)
      })
      .catch(() => toast.error('Errore nel caricamento episodi'))
      .finally(() => setLoading(false))
  }, [seriesId])

  const presentEpisodes = episodes.filter(e => e.hasFile)
  const seasons = [...new Set(presentEpisodes.map(e => e.seasonNumber))].sort((a, b) => a - b)

  const toggleSeason = (season: number) => {
    setCollapsedSeasons(prev => {
      const next = new Set(prev)
      if (next.has(season)) next.delete(season)
      else next.add(season)
      return next
    })
  }

  const toggleEpisode = async (episodeId: number) => {
    if (expandedEpisodeId === episodeId) {
      setExpandedEpisodeId(null)
      setReleases([])
      return
    }
    setExpandedEpisodeId(episodeId)
    setReleases([])
    setLoadingReleases(true)
    const loadingToastId = toast.loading('Ricerca torrent in corso...')
    try {
      const res = await fetch(`/api/sonarr/release?episodeId=${episodeId}`)
      const data = await res.json()
      if (Array.isArray(data)) setReleases(data)
      else {
        setReleases([])
        toast.error('Errore nella ricerca torrent')
      }
    } catch (err) {
      toast.error(`Errore nella ricerca torrent: ${err instanceof Error ? err.message : 'sconosciuto'}`)
      setReleases([])
    } finally {
      toast.dismiss(loadingToastId)
      setLoadingReleases(false)
    }
  }

  const handleGrab = async (guid: string, indexerId: number) => {
    const res = await fetch('/api/sonarr/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guid, indexerId }),
    })
    if (!res.ok) throw new Error('Grab failed')
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin text-violet-400" /> Caricamento episodi...
      </div>
    )
  }

  if (presentEpisodes.length === 0) {
    return <p className="text-sm text-slate-500 py-6 px-2 text-center">Nessun episodio presente su disco</p>
  }

  return (
    <div className="space-y-1">
      {seasons.map(season => (
        <div key={season}>
          <button
            onClick={() => toggleSeason(season)}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer"
          >
            {collapsedSeasons.has(season) ? <ChevronRight size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
            Stagione {season}
            <span className="text-xs text-slate-600 ml-1">
              ({presentEpisodes.filter(e => e.seasonNumber === season).length} episodi)
            </span>
          </button>
          {!collapsedSeasons.has(season) && (
            <div className="ml-4 space-y-0.5">
              {presentEpisodes
                .filter(e => e.seasonNumber === season)
                .sort((a, b) => a.episodeNumber - b.episodeNumber)
                .map(ep => (
                  <div key={ep.id}>
                    <button
                      onClick={() => toggleEpisode(ep.id)}
                      className={`flex items-center gap-3 w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                        expandedEpisodeId === ep.id
                          ? 'bg-violet-500/10 text-white'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-300'
                      }`}
                    >
                      <span className="text-slate-500 w-6 text-right tabular-nums">{ep.episodeNumber}</span>
                      {ep.airDateUtc && (
                        <span className="text-slate-600 text-xs tabular-nums">
                          {new Date(ep.airDateUtc).toLocaleDateString('it-IT')}
                        </span>
                      )}
                    </button>
                    {expandedEpisodeId === ep.id && (
                      <div className="ml-8 mt-1.5 mb-2 border border-white/[0.06] rounded-xl overflow-hidden bg-white/[0.02]">
                        {loadingReleases ? (
                          <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-500">
                            <Loader2 size={14} className="animate-spin text-violet-400" /> Ricerca torrent...
                          </div>
                        ) : (
                          <ReleaseTable releases={releases} onGrab={handleGrab} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
