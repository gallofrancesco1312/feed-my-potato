# Interactive Torrent Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current auto-search workflow with an interactive torrent browser where users click a search result to see available torrents and manually pick which one to download.

**Architecture:** The search page gets an accordion pattern — clicking a result expands it inline to show torrents (movies) or episodes then torrents (series). Four new API routes proxy Radarr/Sonarr release endpoints. Items are auto-added to the library on first expand. Toast notifications confirm every action.

**Tech Stack:** Next.js 16 (App Router), React 19, Radarr/Sonarr v3 API, sonner (toasts), Tailwind CSS, shadcn Table component, lucide-react icons.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `app/api/radarr/release/route.ts` | Proxy GET (search releases) + POST (grab) to Radarr |
| Create | `app/api/sonarr/release/route.ts` | Proxy GET (search releases) + POST (grab) to Sonarr |
| Create | `components/ReleaseTable.tsx` | Sortable torrent table with grab buttons |
| Create | `components/EpisodeList.tsx` | Season-grouped episode list with nested release tables |
| Create | `components/SearchResultCard.tsx` | Expandable card: auto-add to library, show releases or episodes |
| Modify | `app/search/page.tsx` | Orchestrate expanded state, delegate rendering to SearchResultCard |
| Modify | `lib/arr-client.ts:23` | Add `release` to the 30s timeout paths |
| Modify | `app/layout.tsx` | Add `<Toaster />` from sonner |

---

### Task 1: Add Toaster to layout

The sonner `<Toaster />` component exists in `components/ui/sonner.tsx` but is not rendered anywhere. It must be added to the root layout so `toast()` calls work.

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add Toaster import and render**

In `app/layout.tsx`, add the import and render `<Toaster />` inside `<body>`:

```tsx
import { Toaster } from '@/components/ui/sonner'
```

Then inside the `<body>` tag, after `<main>`:

```tsx
<body className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
  <Sidebar />
  <main className="flex-1 overflow-auto p-6">{children}</main>
  <Toaster position="bottom-right" />
</body>
```

- [ ] **Step 2: Verify the app builds**

Run: `cd /home/frangallo/feed-my-potato/.worktrees/arr-remodel && npx next build 2>&1 | tail -20`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add sonner Toaster to root layout"
```

---

### Task 2: Extend arrFetch timeout for release paths

The `arrFetch` function in `lib/arr-client.ts` uses a 30s timeout for `lookup` paths and 15s for everything else. Release searches are also slow (they query indexers in real-time), so they need the 30s timeout too.

**Files:**
- Modify: `lib/arr-client.ts:23`

- [ ] **Step 1: Update the timeout condition**

In `lib/arr-client.ts`, change line 23 from:

```ts
const timeout = path.includes('lookup') ? 30000 : 15000
```

to:

```ts
const timeout = path.includes('lookup') || path.includes('release') ? 30000 : 15000
```

- [ ] **Step 2: Verify the app builds**

Run: `cd /home/frangallo/feed-my-potato/.worktrees/arr-remodel && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add lib/arr-client.ts
git commit -m "feat: extend 30s timeout to release API paths"
```

---

### Task 3: Create Radarr release API route

**Files:**
- Create: `app/api/radarr/release/route.ts`

- [ ] **Step 1: Create the route file**

Create `app/api/radarr/release/route.ts`:

```ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('radarr', `/release${search}`)
}

export async function POST(req: Request) {
  const body = await req.text()
  return arrProxy('radarr', '/release', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

This follows the exact pattern used by `app/api/radarr/movie/route.ts`. The GET handler passes through query params (e.g. `?movieId=123`). The POST handler forwards the JSON body for grab operations.

- [ ] **Step 2: Verify the app builds**

Run: `cd /home/frangallo/feed-my-potato/.worktrees/arr-remodel && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/radarr/release/route.ts
git commit -m "feat: add Radarr release API route (search + grab)"
```

---

### Task 4: Create Sonarr release API route

**Files:**
- Create: `app/api/sonarr/release/route.ts`

- [ ] **Step 1: Create the route file**

Create `app/api/sonarr/release/route.ts`:

```ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('sonarr', `/release${search}`)
}

export async function POST(req: Request) {
  const body = await req.text()
  return arrProxy('sonarr', '/release', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

Identical pattern to the Radarr release route but proxies to Sonarr. GET passes `?episodeId=` query params.

- [ ] **Step 2: Verify the app builds**

Run: `cd /home/frangallo/feed-my-potato/.worktrees/arr-remodel && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/sonarr/release/route.ts
git commit -m "feat: add Sonarr release API route (search + grab)"
```

---

### Task 5: Create ReleaseTable component

The reusable table that shows available torrents for a movie or episode. Supports client-side sorting by clicking column headers. Each row has a download button that calls the grab callback.

**Files:**
- Create: `components/ReleaseTable.tsx`

- [ ] **Step 1: Create the component**

Create `components/ReleaseTable.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'

export interface Release {
  title: string
  quality: { quality: { name: string } }
  languages: { id: number; name: string }[]
  indexer: string
  age: number
  size: number
  seeders: number
  leechers: number
  guid: string
  indexerId: number
}

type SortField = 'seeders' | 'leechers' | 'size' | 'age' | 'quality'
type SortDir = 'asc' | 'desc'

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatAge(days: number): string {
  if (days < 1) return '<1g'
  if (days < 365) return `${Math.round(days)}g`
  return `${(days / 365).toFixed(1)}a`
}

interface ReleaseTableProps {
  releases: Release[]
  onGrab: (guid: string, indexerId: number) => Promise<void>
}

export function ReleaseTable({ releases, onGrab }: ReleaseTableProps) {
  const [sortField, setSortField] = useState<SortField>('seeders')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [grabbing, setGrabbing] = useState<string | null>(null)
  const [grabbed, setGrabbed] = useState<Set<string>>(new Set())

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sorted = [...releases].sort((a, b) => {
    let va: number | string
    let vb: number | string
    if (sortField === 'quality') {
      va = a.quality.quality.name
      vb = b.quality.quality.name
    } else {
      va = a[sortField]
      vb = b[sortField]
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-gray-600" />
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
  }

  const handleGrab = async (release: Release) => {
    setGrabbing(release.guid)
    try {
      await onGrab(release.guid, release.indexerId)
      setGrabbed(prev => new Set(prev).add(release.guid))
      toast.success(`Download avviato: ${release.title}`)
    } catch {
      toast.error('Errore nel download')
    } finally {
      setGrabbing(null)
    }
  }

  if (releases.length === 0) {
    return <p className="text-sm text-gray-500 py-4 px-2">Nessun torrent trovato</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-gray-800">
          <TableHead className="text-xs">Nome</TableHead>
          <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('quality')}>
            <span className="flex items-center gap-1">Qualità <SortIcon field="quality" /></span>
          </TableHead>
          <TableHead className="text-xs">Lingua</TableHead>
          <TableHead className="text-xs">Indexer</TableHead>
          <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('age')}>
            <span className="flex items-center gap-1">Età <SortIcon field="age" /></span>
          </TableHead>
          <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('size')}>
            <span className="flex items-center gap-1">Dim. <SortIcon field="size" /></span>
          </TableHead>
          <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('seeders')}>
            <span className="flex items-center gap-1">Seed <SortIcon field="seeders" /></span>
          </TableHead>
          <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('leechers')}>
            <span className="flex items-center gap-1">Leech <SortIcon field="leechers" /></span>
          </TableHead>
          <TableHead className="text-xs w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map(release => (
          <TableRow key={release.guid} className="border-gray-800/50">
            <TableCell className="text-xs max-w-[300px] truncate" title={release.title}>
              {release.title}
            </TableCell>
            <TableCell className="text-xs">{release.quality.quality.name}</TableCell>
            <TableCell className="text-xs">
              {release.languages?.map(l => l.name).join(', ') || '—'}
            </TableCell>
            <TableCell className="text-xs">{release.indexer}</TableCell>
            <TableCell className="text-xs">{formatAge(release.age)}</TableCell>
            <TableCell className="text-xs">{formatSize(release.size)}</TableCell>
            <TableCell className="text-xs font-medium text-green-400">{release.seeders}</TableCell>
            <TableCell className="text-xs text-red-400">{release.leechers}</TableCell>
            <TableCell>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => handleGrab(release)}
                disabled={grabbing === release.guid || grabbed.has(release.guid)}
              >
                {grabbed.has(release.guid) ? (
                  <Check size={14} className="text-green-400" />
                ) : grabbing === release.guid ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Verify the app builds**

Run: `cd /home/frangallo/feed-my-potato/.worktrees/arr-remodel && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ReleaseTable.tsx
git commit -m "feat: add ReleaseTable component with sortable columns and grab buttons"
```

---

### Task 6: Create EpisodeList component

Shows episodes grouped by season for a series. Each episode row can be expanded to show a ReleaseTable. Only one episode is expanded at a time.

**Files:**
- Create: `components/EpisodeList.tsx`

- [ ] **Step 1: Create the component**

Create `components/EpisodeList.tsx`:

```tsx
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

  const seasons = [...new Set(episodes.map(e => e.seasonNumber))].sort((a, b) => a - b)

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
    try {
      const res = await fetch(`/api/sonarr/release?episodeId=${episodeId}`)
      const data = await res.json()
      if (Array.isArray(data)) setReleases(data)
      else {
        setReleases([])
        toast.error('Errore nella ricerca torrent')
      }
    } catch {
      toast.error('Errore nella ricerca torrent')
      setReleases([])
    } finally {
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
      <div className="flex items-center gap-2 py-4 px-2 text-sm text-gray-500">
        <Loader2 size={14} className="animate-spin" /> Caricamento episodi...
      </div>
    )
  }

  if (episodes.length === 0) {
    return <p className="text-sm text-gray-500 py-4 px-2">Nessun episodio disponibile</p>
  }

  return (
    <div className="space-y-1">
      {seasons.map(season => (
        <div key={season}>
          <button
            onClick={() => toggleSeason(season)}
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800/50 rounded"
          >
            {collapsedSeasons.has(season) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            Stagione {season}
            <span className="text-xs text-gray-500 ml-1">
              ({episodes.filter(e => e.seasonNumber === season).length} episodi)
            </span>
          </button>
          {!collapsedSeasons.has(season) && (
            <div className="ml-4 space-y-0.5">
              {episodes
                .filter(e => e.seasonNumber === season)
                .sort((a, b) => a.episodeNumber - b.episodeNumber)
                .map(ep => (
                  <div key={ep.id}>
                    <button
                      onClick={() => toggleEpisode(ep.id)}
                      className={`flex items-center gap-3 w-full text-left px-2 py-1 text-xs rounded hover:bg-gray-800/50 ${
                        expandedEpisodeId === ep.id ? 'bg-gray-800/50 text-white' : 'text-gray-400'
                      }`}
                    >
                      <span className="text-gray-500 w-6 text-right">{ep.episodeNumber}</span>
                      <span className="flex-1 truncate">{ep.title}</span>
                      {ep.airDateUtc && (
                        <span className="text-gray-600 text-xs">
                          {new Date(ep.airDateUtc).toLocaleDateString('it-IT')}
                        </span>
                      )}
                    </button>
                    {expandedEpisodeId === ep.id && (
                      <div className="ml-8 mt-1 mb-2 border border-gray-800 rounded-lg overflow-hidden">
                        {loadingReleases ? (
                          <div className="flex items-center gap-2 py-4 px-2 text-sm text-gray-500">
                            <Loader2 size={14} className="animate-spin" /> Ricerca torrent...
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
```

- [ ] **Step 2: Verify the app builds**

Run: `cd /home/frangallo/feed-my-potato/.worktrees/arr-remodel && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/EpisodeList.tsx
git commit -m "feat: add EpisodeList component with season groups and nested release tables"
```

---

### Task 7: Create SearchResultCard component

The expandable card that handles auto-adding to library, fetching releases (movies) or episodes (series), and rendering the appropriate sub-component.

**Files:**
- Create: `components/SearchResultCard.tsx`

- [ ] **Step 1: Create the component**

Create `components/SearchResultCard.tsx`:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ReleaseTable, type Release } from '@/components/ReleaseTable'
import { EpisodeList } from '@/components/EpisodeList'

interface LookupResult {
  title: string
  year?: number
  overview?: string
  remotePoster?: string
  tmdbId?: number
  tvdbId?: number
  id?: number
  type: 'movie' | 'series'
}

interface SearchResultCardProps {
  item: LookupResult
  isExpanded: boolean
  onToggle: () => void
}

export function SearchResultCard({ item, isExpanded, onToggle }: SearchResultCardProps) {
  const [libraryId, setLibraryId] = useState<number | null>(item.id ?? null)
  const [loading, setLoading] = useState(false)
  const [releases, setReleases] = useState<Release[]>([])
  const [loadingReleases, setLoadingReleases] = useState(false)
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (!isExpanded) {
      hasInitialized.current = false
      return
    }
    if (hasInitialized.current) return
    hasInitialized.current = true

    const init = async () => {
      let movieId = libraryId

      // Auto-add to library if not present
      if (!movieId) {
        setLoading(true)
        try {
          movieId = await addToLibrary(item)
          setLibraryId(movieId)
        } catch (err) {
          toast.error(`Errore nell'aggiunta: ${err instanceof Error ? err.message : 'sconosciuto'}`)
          setLoading(false)
          return
        }
        setLoading(false)
      }

      // For movies, fetch releases immediately
      if (item.type === 'movie' && movieId) {
        setLoadingReleases(true)
        try {
          const res = await fetch(`/api/radarr/release?movieId=${movieId}`)
          const data = await res.json()
          if (Array.isArray(data)) setReleases(data)
          else toast.error('Errore nella ricerca torrent')
        } catch {
          toast.error('Errore nella ricerca torrent')
        } finally {
          setLoadingReleases(false)
        }
      }
      // For series, EpisodeList handles its own data fetching
    }

    init()
  }, [isExpanded, item, libraryId])

  const handleGrab = async (guid: string, indexerId: number) => {
    const res = await fetch('/api/radarr/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guid, indexerId }),
    })
    if (!res.ok) throw new Error('Grab failed')
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex gap-3 text-left hover:bg-gray-800/30 transition-colors"
      >
        {item.remotePoster && (
          <img
            src={item.remotePoster}
            alt={item.title}
            className="w-16 h-24 object-cover rounded flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{item.title}</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                item.type === 'movie'
                  ? 'bg-blue-900/30 text-blue-400'
                  : 'bg-green-900/30 text-green-400'
              }`}
            >
              {item.type === 'movie' ? 'Film' : 'Serie'}
            </span>
            <span className="ml-auto flex-shrink-0">
              {isExpanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
            </span>
          </div>
          {item.year && <p className="text-xs text-gray-500">{item.year}</p>}
          {item.overview && (
            <p className="text-xs text-gray-400 line-clamp-2 mt-1">{item.overview}</p>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-800 p-3">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" /> Aggiunta alla libreria...
            </div>
          ) : item.type === 'movie' ? (
            loadingReleases ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                <Loader2 size={14} className="animate-spin" /> Ricerca torrent...
              </div>
            ) : (
              <ReleaseTable releases={releases} onGrab={handleGrab} />
            )
          ) : libraryId ? (
            <EpisodeList seriesId={libraryId} />
          ) : null}
        </div>
      )}
    </div>
  )
}

async function addToLibrary(item: LookupResult): Promise<number> {
  if (item.type === 'movie') {
    const [profiles, folders] = await Promise.all([
      fetch('/api/radarr/qualityprofile').then(r => r.json()),
      fetch('/api/radarr/rootfolder').then(r => r.json()),
    ])
    const res = await fetch('/api/radarr/movie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tmdbId: item.tmdbId,
        title: item.title,
        qualityProfileId: profiles[0]?.id,
        rootFolderPath: folders[0]?.path,
        monitored: true,
        addOptions: { searchForMovie: false },
      }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => null)
      throw new Error(Array.isArray(errData) ? errData[0]?.errorMessage : 'Aggiunta fallita')
    }
    const movie = await res.json()
    toast.success('Film aggiunto alla libreria')
    return movie.id
  } else {
    const [profiles, folders] = await Promise.all([
      fetch('/api/sonarr/qualityprofile').then(r => r.json()),
      fetch('/api/sonarr/rootfolder').then(r => r.json()),
    ])
    const res = await fetch('/api/sonarr/series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tvdbId: item.tvdbId,
        title: item.title,
        qualityProfileId: profiles[0]?.id,
        rootFolderPath: folders[0]?.path,
        monitored: true,
        addOptions: { searchForMissingEpisodes: false },
      }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => null)
      throw new Error(Array.isArray(errData) ? errData[0]?.errorMessage : 'Aggiunta fallita')
    }
    const series = await res.json()
    toast.success('Serie aggiunta alla libreria')
    return series.id
  }
}
```

- [ ] **Step 2: Verify the app builds**

Run: `cd /home/frangallo/feed-my-potato/.worktrees/arr-remodel && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/SearchResultCard.tsx
git commit -m "feat: add SearchResultCard with auto-add-to-library and accordion expansion"
```

---

### Task 8: Rewrite SearchPage to use new components

Replace the inline card rendering and `addItem` logic with the new `SearchResultCard` component. Add `expandedIndex` state to track which result is expanded (only one at a time).

**Files:**
- Modify: `app/search/page.tsx`

- [ ] **Step 1: Rewrite the search page**

Replace the entire contents of `app/search/page.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
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
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('all')
  const [results, setResults] = useState<LookupResult[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setResults([])
    setExpandedIndex(null)
    try {
      const promises: Promise<LookupResult[]>[] = []
      if (mode === 'movie' || mode === 'all') {
        promises.push(
          fetch(`/api/radarr/lookup?term=${encodeURIComponent(query)}`)
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
          fetch(`/api/sonarr/lookup?term=${encodeURIComponent(query)}`)
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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cerca</h1>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Cerca film o serie..."
          className="flex-1"
        />
        <Button
          onClick={search}
          disabled={loading}
          className="px-3 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-600 disabled:opacity-50"
        >
          <SearchIcon size={16} />
        </Button>
      </div>
      <div className="flex gap-2">
        {(['all', 'movie', 'series'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-sm px-3 py-1 rounded ${
              mode === m ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {m === 'all' ? 'Tutti' : m === 'movie' ? 'Film' : 'Serie TV'}
          </button>
        ))}
      </div>
      {loading && <p className="text-gray-500">Ricerca in corso...</p>}
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
```

Key changes from the original:
- Replaced `adding` state with `expandedIndex` state.
- Removed `addItem` function (now inside `SearchResultCard`).
- Changed from a grid layout (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) to a vertical stack (`space-y-3`) since expanded cards need full width.
- Each card is now a `<SearchResultCard>` with expand/collapse behavior.
- New search clears `expandedIndex`.

- [ ] **Step 2: Verify the app builds**

Run: `cd /home/frangallo/feed-my-potato/.worktrees/arr-remodel && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/search/page.tsx
git commit -m "feat: rewrite search page with accordion torrent selection"
```

---

### Task 9: Manual integration test

Verify the full flow works end-to-end with the running Docker stack.

**Files:** None (testing only)

- [ ] **Step 1: Rebuild and start the app**

Run: `cd /home/frangallo/feed-my-potato/.worktrees/arr-remodel && docker compose up -d --build`
Expected: All services start successfully.

- [ ] **Step 2: Test movie search and torrent selection**

Open the app in a browser and navigate to the search page:
1. Search for a movie (e.g. "The Matrix")
2. Verify results appear as cards with poster, title, year, type badge
3. Click on a movie card → verify accordion expands
4. Verify toast "Film aggiunto alla libreria" appears (if not already in library)
5. Verify torrent list loads with columns: Nome, Qualità, Lingua, Indexer, Età, Dim., Seed, Leech
6. Verify table is sorted by seeders descending by default
7. Click a column header → verify sort changes
8. Click download on a torrent → verify spinner, then check icon, then toast "Download avviato: ..."
9. Click the same card again → verify accordion collapses
10. Click a different card → verify previous one collapses, new one expands

- [ ] **Step 3: Test series search and episode drill-down**

1. Search for a TV series (e.g. "Breaking Bad")
2. Click on a series card → verify accordion expands with episode list
3. Verify toast "Serie aggiunta alla libreria" appears (if not already in library)
4. Verify seasons are listed with collapsible headers ("Stagione 1", etc.)
5. Click a season header → verify it collapses/expands
6. Click an episode → verify torrent list loads for that episode
7. Click download on a torrent → verify grab works with toast

- [ ] **Step 4: Test error states**

1. Verify clicking a card that's already in the library skips the add step
2. Verify empty torrent results show "Nessun torrent trovato"

- [ ] **Step 5: Commit any fixes needed**

If any fixes were needed during testing, commit them:
```bash
git add -A
git commit -m "fix: address issues found during integration testing"
```
