'use client'

import { useState, useEffect, useRef } from 'react'

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'is', 'it', 'il', 'la', 'le', 'lo', 'di', 'da', 'del', 'della', 'dei'])

function keywords(title: string): string[] {
  return title
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
}

function filterByTitle(releases: Release[], title: string): Release[] {
  const kws = keywords(title)
  if (kws.length === 0) return releases
  return releases.filter(r => kws.every(kw => r.title.toLowerCase().includes(kw)))
}
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ReleaseTable, type Release } from '@/components/ReleaseTable'

interface Season {
  seasonNumber: number
  monitored?: boolean
}

interface LookupResult {
  title: string
  year?: number
  overview?: string
  remotePoster?: string
  tmdbId?: number
  tvdbId?: number
  imdbId?: string
  id?: number
  type: 'movie' | 'series'
  seasons?: Season[]
}

interface SearchResultCardProps {
  item: LookupResult
  isExpanded: boolean
  onToggle: () => void
}

export function SearchResultCard({ item, isExpanded, onToggle }: SearchResultCardProps) {
  const [releases, setReleases] = useState<Release[]>([])
  const [loadingReleases, setLoadingReleases] = useState(false)
  const hasInitialized = useRef(false)

  // Series: track which season is expanded and its releases
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null)
  const [seasonReleases, setSeasonReleases] = useState<Release[]>([])
  const [loadingSeasonReleases, setLoadingSeasonReleases] = useState(false)
  const addedToLibrary = useRef(false)
  const lastItemId = useRef<number | undefined>(undefined)

  // Reset library flag when the item changes
  useEffect(() => {
    const id = item.type === 'movie' ? item.tmdbId : item.tvdbId
    if (id !== lastItemId.current) {
      addedToLibrary.current = false
      lastItemId.current = id
    }
  }, [item.type, item.tmdbId, item.tvdbId])

  useEffect(() => {
    if (!isExpanded) {
      hasInitialized.current = false
      return
    }
    if (hasInitialized.current) return
    if (item.type === 'series') return // series don't auto-search on expand
    hasInitialized.current = true

    const searchReleases = async () => {
      setLoadingReleases(true)
      const loadingToastId = toast.loading('Ricerca torrent in corso...')
      try {
        const query = item.year ? `${item.title} ${item.year}` : item.title
        const res = await fetch(`/api/prowlarr/search?query=${encodeURIComponent(query)}&type=movie`)
        const data = await res.json()
        if (Array.isArray(data)) setReleases(filterByTitle(data, item.title))
        else toast.error('Errore nella ricerca torrent')
      } catch (err) {
        toast.error(`Errore nella ricerca torrent: ${err instanceof Error ? err.message : 'sconosciuto'}`)
      } finally {
        toast.dismiss(loadingToastId)
        setLoadingReleases(false)
      }
    }

    searchReleases()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded])

  const searchSeasonReleases = async (seasonNum: number) => {
    if (expandedSeason === seasonNum) {
      setExpandedSeason(null)
      setSeasonReleases([])
      return
    }
    setExpandedSeason(seasonNum)
    setSeasonReleases([])
    setLoadingSeasonReleases(true)
    const loadingToastId = toast.loading('Ricerca torrent in corso...')
    try {
      const pad = String(seasonNum).padStart(2, '0')
      const query = `${item.title} S${pad}`
      const res = await fetch(`/api/prowlarr/search?query=${encodeURIComponent(query)}&type=tvsearch`)
      const data = await res.json()
      if (Array.isArray(data)) setSeasonReleases(filterByTitle(data, item.title))
      else toast.error('Errore nella ricerca torrent')
    } catch (err) {
      toast.error(`Errore nella ricerca torrent: ${err instanceof Error ? err.message : 'sconosciuto'}`)
    } finally {
      toast.dismiss(loadingToastId)
      setLoadingSeasonReleases(false)
    }
  }

  const handleGrab = async (guid: string, _indexerId: number) => {
    const allReleases = item.type === 'movie' ? releases : seasonReleases
    const release = allReleases.find(r => r.guid === guid)
    if (!release?.downloadUrl) throw new Error('URL download non disponibile')

    if (!addedToLibrary.current) {
      try {
        await addToLibrary(item)
        addedToLibrary.current = true
      } catch (err) {
        toast.error(
          `Impossibile aggiungere alla libreria: ${err instanceof Error ? err.message : 'errore sconosciuto'}`,
        )
        throw err
      }
    }

    // Push release through Sonarr/Radarr so they manage the download lifecycle
    const endpoint = item.type === 'movie'
      ? '/api/radarr/release/push'
      : '/api/sonarr/release/push'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: release.title,
        downloadUrl: release.downloadUrl,
        protocol: 'torrent',
        publishDate: new Date().toISOString(),
        indexer: release.indexer,
      }),
    })
    if (!res.ok) throw new Error('Download fallito')
  }

  const seasons = (item.seasons ?? [])
    .filter(s => s.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)

  return (
    <div className="glass-card rounded-xl overflow-hidden transition-all duration-200 hover:border-white/[0.1]">
      <button
        onClick={onToggle}
        className="w-full p-4 flex gap-4 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        {item.remotePoster && (
          <img
            src={item.remotePoster}
            alt={item.title}
            className="w-16 h-24 object-cover rounded-lg flex-shrink-0"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate text-white">{item.title}</span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                item.type === 'movie'
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              {item.type === 'movie' ? 'Film' : 'Serie'}
            </span>
            <span className="ml-auto flex-shrink-0">
              {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
            </span>
          </div>
          {item.year && <p className="text-xs text-slate-500 mt-0.5">{item.year}</p>}
          {item.overview && (
            <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">{item.overview}</p>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/[0.06] p-4">
          {item.type === 'movie' ? (
            loadingReleases ? (
              <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin text-violet-400" /> Ricerca torrent...
              </div>
            ) : (
              <ReleaseTable releases={releases} onGrab={handleGrab} />
            )
          ) : (
            <div className="space-y-1">
              {seasons.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">Nessuna stagione disponibile</p>
              )}
              {seasons.map(season => (
                <div key={season.seasonNumber}>
                  <button
                    onClick={() => searchSeasonReleases(season.seasonNumber)}
                    className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                      expandedSeason === season.seasonNumber
                        ? 'bg-violet-500/10 text-white'
                        : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    {expandedSeason === season.seasonNumber
                      ? <ChevronDown size={14} />
                      : <ChevronRight size={14} />}
                    Stagione {season.seasonNumber}
                  </button>
                  {expandedSeason === season.seasonNumber && (
                    <div className="ml-4 mt-1 mb-2 border border-white/[0.06] rounded-lg overflow-hidden">
                      {loadingSeasonReleases ? (
                        <div className="flex items-center gap-2 py-4 px-2 text-sm text-slate-500">
                          <Loader2 size={14} className="animate-spin text-violet-400" /> Ricerca torrent...
                        </div>
                      ) : (
                        <ReleaseTable releases={seasonReleases} onGrab={handleGrab} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

async function addToLibrary(item: LookupResult): Promise<void> {
  if (item.type === 'movie') {
    const [profiles, folders] = await Promise.all([
      fetch('/api/radarr/qualityprofile').then(r => r.json()),
      fetch('/api/radarr/rootfolder').then(r => r.json()),
    ])
    const rootPath = (Array.isArray(folders) && folders[0]?.path) || '/data/movies'
    const res = await fetch('/api/radarr/movie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tmdbId: item.tmdbId,
        title: item.title,
        qualityProfileId: profiles[0]?.id,
        rootFolderPath: rootPath,
        monitored: true,
        addOptions: { searchForMovie: false },
      }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => null)
      const msg = Array.isArray(errData) ? errData[0]?.errorMessage : ''
      if (!msg?.includes('already been added')) throw new Error(msg || 'Aggiunta fallita')
    }
  } else {
    const [profiles, folders] = await Promise.all([
      fetch('/api/sonarr/qualityprofile').then(r => r.json()),
      fetch('/api/sonarr/rootfolder').then(r => r.json()),
    ])
    const rootPath = (Array.isArray(folders) && folders[0]?.path) || '/data/series'
    const res = await fetch('/api/sonarr/series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tvdbId: item.tvdbId,
        title: item.title,
        qualityProfileId: profiles[0]?.id,
        rootFolderPath: rootPath,
        monitored: true,
        addOptions: { searchForMissingEpisodes: false },
      }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => null)
      const msg = Array.isArray(errData) ? errData[0]?.errorMessage : ''
      if (!msg?.includes('already been added')) throw new Error(msg || 'Aggiunta fallita')
    }
  }
}
