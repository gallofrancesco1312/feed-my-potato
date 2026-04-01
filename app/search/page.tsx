'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search as SearchIcon, Clock, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SearchResultCard } from '@/components/SearchResultCard'

type SearchMode = 'movie' | 'series' | 'all'

interface LookupResult {
  title: string
  year?: number
  overview?: string
  remotePoster?: string
  tmdbId?: number
  tvdbId?: number
  id?: number
  type: 'movie' | 'series'
  seasons?: { seasonNumber: number; monitored?: boolean }[]
}

const RECENT_SEARCHES_KEY = 'feed-my-plex-recent-searches'
const MAX_RECENT = 8

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecentSearches(searches: string[]) {
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches))
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('all')
  const [results, setResults] = useState<LookupResult[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    setRecentSearches(loadRecentSearches())
  }, [])

  const addToRecent = useCallback((term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT)
      saveRecentSearches(updated)
      return updated
    })
  }, [])

  const removeFromRecent = useCallback((term: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== term)
      saveRecentSearches(updated)
      return updated
    })
  }, [])

  const clearRecent = useCallback(() => {
    setRecentSearches([])
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  }, [])

  const search = async (overrideQuery?: string) => {
    const term = overrideQuery ?? query
    if (!term.trim()) return
    if (overrideQuery) setQuery(overrideQuery)
    addToRecent(term)
    setLoading(true)
    setResults([])
    setExpandedIndex(null)
    setHasSearched(true)
    try {
      const promises: Promise<LookupResult[]>[] = []
      if (mode === 'movie' || mode === 'all') {
        promises.push(
          fetch(`/api/radarr/lookup?term=${encodeURIComponent(term)}`)
            .then(r => r.json())
            .then(data =>
              Array.isArray(data)
                ? data.map((d: LookupResult) => ({ ...d, type: 'movie' as const }))
                : [],
            ),
        )
      }
      if (mode === 'series' || mode === 'all') {
        promises.push(
          fetch(`/api/sonarr/lookup?term=${encodeURIComponent(term)}`)
            .then(r => r.json())
            .then(data =>
              Array.isArray(data)
                ? data.map((d: LookupResult) => ({ ...d, type: 'series' as const }))
                : [],
            ),
        )
      }
      const all = (await Promise.all(promises)).flat()
      setResults(all)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Cerca</h1>
        <p className="text-sm text-slate-500 mt-1">Cerca e aggiungi film o serie alla tua libreria</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search(query)}
            placeholder="Cerca film o serie..."
            className="pl-11 h-11 bg-white/[0.04] border-white/[0.08] rounded-xl text-white placeholder:text-slate-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all"
          />
        </div>
        <Button
          onClick={() => search(query)}
          disabled={loading}
          className="h-11 px-6 bg-violet-600 text-white rounded-xl hover:bg-violet-500 disabled:opacity-50 transition-all cursor-pointer"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Cerca'
          )}
        </Button>
      </div>

      {/* Mode filter pills */}
      <div className="flex gap-2">
        {(['all', 'movie', 'series'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-xs font-medium px-4 py-2 rounded-full transition-all duration-200 cursor-pointer ${
              mode === m
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'bg-white/[0.04] text-slate-400 border border-transparent hover:bg-white/[0.06] hover:text-slate-300'
            }`}
          >
            {m === 'all' ? 'Tutti' : m === 'movie' ? 'Film' : 'Serie TV'}
          </button>
        ))}
      </div>

      {/* Recent searches */}
      {!hasSearched && !loading && recentSearches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock size={14} />
              <span className="text-xs font-medium uppercase tracking-wider">Ricerche recenti</span>
            </div>
            <button
              onClick={clearRecent}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
            >
              Cancella tutto
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map(term => (
              <div
                key={term}
                className="group flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-full pl-4 pr-2 py-1.5 hover:bg-violet-500/10 hover:border-violet-500/20 transition-all"
              >
                <button
                  onClick={() => search(term)}
                  className="text-sm text-slate-300 group-hover:text-violet-300 transition-colors cursor-pointer"
                >
                  {term}
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    removeFromRecent(term)
                  }}
                  className="p-0.5 rounded-full text-slate-600 hover:text-red-400 hover:bg-white/[0.06] transition-all cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && results.length === 0 && hasSearched && (
        <div className="glass-card rounded-xl p-12 text-center">
          <SearchIcon size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Nessun risultato trovato.</p>
        </div>
      )}

      <div className="space-y-3">
        {results.map((item, i) => (
          <SearchResultCard
            key={`${item.type}-${item.tmdbId ?? item.tvdbId ?? i}`}
            item={item}
            isExpanded={expandedIndex === i}
            onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
          />
        ))}
      </div>
    </div>
  )
}
