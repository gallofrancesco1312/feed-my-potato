# UI Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add movie/series removal actions, overhaul the dashboard with Recharts charts and disk space widget, and improve the download page with extended torrent data and complete Italian status labels.

**Architecture:** Three independent feature sets sharing the existing arrProxy API pattern. Dashboard uses Recharts for donut and bar charts in a hero+sidebar layout. Download page transitions from table rows to card-based layout with a complete qBittorrent state map. Movie/series pages gain action menus for unmonitoring and deleting items — API routes already exist (`PUT`/`DELETE` on `/api/radarr/movie/[id]` and `/api/sonarr/series/[id]`).

**Tech Stack:** Next.js 16, React 19, Recharts (new), shadcn/ui, Tailwind CSS v4, Sonner toasts, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-26-ui-enhancements-design.md`

---

## File Structure

### New Files
- `lib/torrent-utils.ts` — Formatting utilities and state config for torrents
- `components/charts/LibraryDonut.tsx` — Donut chart for library status (scaricati/mancanti/non monitorati)
- `components/charts/DiskSpaceDonut.tsx` — Donut chart for disk usage with film/serie breakdown
- `components/charts/MonthlyAdditions.tsx` — Bar chart for items added per month
- `__tests__/api/torrent-utils.test.ts` — Tests for torrent formatting utilities

### Modified Files
- `lib/qbittorrent.ts` — Extend `Torrent` interface with new fields
- `components/TorrentRow.tsx` — Rewrite as card layout with extended data and full state map
- `app/downloads/page.tsx` — Change from `<table>` to `<div>` container
- `app/movies/page.tsx` — Add action menu (unmonitor/delete) to movie cards
- `app/series/page.tsx` — Add action buttons (unmonitor/delete) to series rows
- `app/page.tsx` — Dashboard overhaul with hero+sidebar layout and chart components
- `package.json` — Add recharts dependency

---

## Task 1: Install Recharts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install recharts**

Run:
```bash
npm install recharts
```

- [ ] **Step 2: Verify installation**

Run:
```bash
node -e "require('recharts'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts dependency for dashboard charts"
```

---

## Task 2: Torrent Utilities and Extended Interface

**Files:**
- Modify: `lib/qbittorrent.ts`
- Create: `lib/torrent-utils.ts`
- Create: `__tests__/api/torrent-utils.test.ts`

- [ ] **Step 1: Write failing tests for torrent utilities**

Create `__tests__/api/torrent-utils.test.ts`:

```typescript
import {
  formatSize,
  formatDate,
  extractTrackerHost,
  getStateConfig,
  BADGE_COLORS,
} from '@/lib/torrent-utils'

describe('formatSize', () => {
  test('formats bytes as KB', () => {
    expect(formatSize(512)).toBe('512 B')
  })

  test('formats kilobytes', () => {
    expect(formatSize(15_000)).toBe('14.6 KB')
  })

  test('formats megabytes', () => {
    expect(formatSize(850_000_000)).toBe('810.6 MB')
  })

  test('formats gigabytes', () => {
    expect(formatSize(4_500_000_000)).toBe('4.2 GB')
  })

  test('formats terabytes', () => {
    expect(formatSize(1_200_000_000_000)).toBe('1.1 TB')
  })

  test('formats zero', () => {
    expect(formatSize(0)).toBe('0 B')
  })
})

describe('formatDate', () => {
  test('formats unix timestamp as Italian date', () => {
    // 2026-03-25 12:00:00 UTC
    const result = formatDate(1774699200)
    expect(result).toMatch(/25 mar 2026/)
  })

  test('returns empty string for zero', () => {
    expect(formatDate(0)).toBe('')
  })
})

describe('extractTrackerHost', () => {
  test('extracts hostname from tracker URL', () => {
    expect(extractTrackerHost('udp://tracker.example.com:6969/announce')).toBe(
      'tracker.example.com',
    )
  })

  test('extracts hostname from HTTP tracker', () => {
    expect(extractTrackerHost('https://tracker.site.org:443/announce')).toBe(
      'tracker.site.org',
    )
  })

  test('returns raw string if not a valid URL', () => {
    expect(extractTrackerHost('not-a-url')).toBe('not-a-url')
  })

  test('returns empty string for empty input', () => {
    expect(extractTrackerHost('')).toBe('')
  })
})

describe('getStateConfig', () => {
  test('returns config for downloading state', () => {
    const cfg = getStateConfig('downloading')
    expect(cfg.label).toBe('Scaricando')
    expect(cfg.color).toBe('blue')
  })

  test('returns config for stalledUP state', () => {
    const cfg = getStateConfig('stalledUP')
    expect(cfg.label).toBe('In seeding')
    expect(cfg.color).toBe('green')
  })

  test('returns config for error state', () => {
    const cfg = getStateConfig('error')
    expect(cfg.label).toBe('Errore')
    expect(cfg.color).toBe('red')
  })

  test('returns unknown config for unrecognized state', () => {
    const cfg = getStateConfig('something_new')
    expect(cfg.label).toBe('something_new')
    expect(cfg.color).toBe('gray')
  })
})

describe('BADGE_COLORS', () => {
  test('has entries for all color families', () => {
    expect(BADGE_COLORS.blue).toBeDefined()
    expect(BADGE_COLORS.green).toBeDefined()
    expect(BADGE_COLORS.yellow).toBeDefined()
    expect(BADGE_COLORS.gray).toBeDefined()
    expect(BADGE_COLORS.red).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npx jest __tests__/api/torrent-utils.test.ts -v
```
Expected: FAIL — module `@/lib/torrent-utils` not found

- [ ] **Step 3: Extend Torrent interface**

Modify `lib/qbittorrent.ts` — replace the `Torrent` interface:

```typescript
export interface Torrent {
  hash: string
  name: string
  progress: number
  dlspeed: number
  upspeed: number
  eta: number
  size: number
  total_size: number
  uploaded: number
  downloaded: number
  ratio: number
  num_seeds: number
  num_leechs: number
  added_on: number
  tracker: string
  category: string
  state: string
  savePath: string
  contentPath: string
}
```

- [ ] **Step 4: Create torrent-utils module**

Create `lib/torrent-utils.ts`:

```typescript
export interface StateConfig {
  label: string
  color: 'blue' | 'green' | 'yellow' | 'gray' | 'red'
}

const STATE_MAP: Record<string, StateConfig> = {
  // Download (blue)
  downloading:        { label: 'Scaricando',            color: 'blue' },
  forcedDL:           { label: 'Download forzato',      color: 'blue' },
  metaDL:             { label: 'Scaricando metadati',   color: 'blue' },

  // Waiting/Queued (yellow)
  stalledDL:          { label: 'In attesa (download)',   color: 'yellow' },
  queuedDL:           { label: 'In coda (download)',     color: 'yellow' },
  allocating:         { label: 'Allocazione spazio',     color: 'yellow' },

  // Seeding (green)
  uploading:          { label: 'In seeding',             color: 'green' },
  stalledUP:          { label: 'In seeding',             color: 'green' },
  forcedUP:           { label: 'Seeding forzato',        color: 'green' },
  queuedUP:           { label: 'In coda (seeding)',      color: 'green' },

  // Paused/Checking (gray)
  pausedDL:           { label: 'In pausa',               color: 'gray' },
  pausedUP:           { label: 'In pausa (completo)',    color: 'gray' },
  checkingDL:         { label: 'Verifica file',          color: 'gray' },
  checkingUP:         { label: 'Verifica file',          color: 'gray' },
  checkingResumeData: { label: 'Verifica ripresa',       color: 'gray' },
  moving:             { label: 'Spostamento file',       color: 'gray' },

  // Error (red)
  error:              { label: 'Errore',                 color: 'red' },
  missingFiles:       { label: 'File mancanti',          color: 'red' },
  unknown:            { label: 'Sconosciuto',            color: 'gray' },
}

export const BADGE_COLORS: Record<StateConfig['color'], string> = {
  blue:   'bg-blue-900/30 text-blue-400',
  green:  'bg-green-900/30 text-green-400',
  yellow: 'bg-yellow-900/30 text-yellow-400',
  gray:   'bg-gray-700/30 text-gray-400',
  red:    'bg-red-900/30 text-red-400',
}

export function getStateConfig(state: string): StateConfig {
  return STATE_MAP[state] ?? { label: state, color: 'gray' as const }
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const val = bytes / Math.pow(1024, i)
  return `${i === 0 ? val : val.toFixed(1)} ${units[i]}`
}

export function formatDate(unixTimestamp: number): string {
  if (!unixTimestamp) return ''
  return new Date(unixTimestamp * 1000).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function extractTrackerHost(url: string): string {
  if (!url) return ''
  try {
    // Handle udp:// and other non-standard protocols
    const normalized = url.replace(/^udp:/, 'http:')
    return new URL(normalized).hostname
  } catch {
    return url
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npx jest __tests__/api/torrent-utils.test.ts -v
```
Expected: All 14 tests PASS

- [ ] **Step 6: Commit**

```bash
git add lib/qbittorrent.ts lib/torrent-utils.ts __tests__/api/torrent-utils.test.ts
git commit -m "feat: add torrent utilities with complete Italian state map and formatting helpers"
```

---

## Task 3: Rewrite TorrentRow as Card Layout

**Files:**
- Modify: `components/TorrentRow.tsx`
- Modify: `app/downloads/page.tsx`

- [ ] **Step 1: Rewrite TorrentRow component**

Replace the entire content of `components/TorrentRow.tsx`:

```tsx
import { Progress } from '@/components/ui/progress'
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
  if (secs > 86400 || secs < 0) return '∞'
  if (secs > 3600) return `${Math.floor(secs / 3600)}h`
  if (secs > 60) return `${Math.floor(secs / 60)}m`
  return `${secs}s`
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase text-gray-500">{label}</span>
      <span className="text-xs text-gray-300">{value}</span>
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
  const pct = Math.round(torrent.progress * 100)
  const stateConfig = getStateConfig(torrent.state)
  const isPaused = torrent.state === 'pausedDL' || torrent.state === 'pausedUP'

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-3">
      {/* Row 1: Name + badges */}
      <div className="flex items-center gap-2">
        <p className="font-medium truncate flex-1">{torrent.name}</p>
        <Badge className={BADGE_COLORS[stateConfig.color]}>{stateConfig.label}</Badge>
        {labelProp === 'Film' && (
          <Badge className="bg-blue-900/30 text-blue-400">Film</Badge>
        )}
        {labelProp === 'Serie' && (
          <Badge className="bg-green-900/30 text-green-400">Serie</Badge>
        )}
      </div>

      {/* Row 2: Progress bar */}
      <div className="flex items-center gap-3">
        <Progress value={pct} className="h-2 flex-1" />
        <span className="text-sm text-gray-400 w-12 text-right">{pct}%</span>
      </div>

      {/* Row 3: Metadata grid */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
        <MetaItem label="Dimensione" value={formatSize(torrent.total_size || torrent.size)} />
        <MetaItem label="Seed / Peer" value={`${torrent.num_seeds ?? 0} / ${torrent.num_leechs ?? 0}`} />
        <MetaItem label="Ratio" value={(torrent.ratio ?? 0).toFixed(2)} />
        <MetaItem label="Velocità DL" value={formatSpeed(torrent.dlspeed)} />
        <MetaItem label="Velocità UP" value={formatSpeed(torrent.upspeed ?? 0)} />
        <MetaItem label="ETA" value={formatEta(torrent.eta)} />
        <MetaItem label="Aggiunto il" value={formatDate(torrent.added_on ?? 0)} />
        <MetaItem label="Tracker" value={extractTrackerHost(torrent.tracker ?? '')} />
      </div>

      {/* Row 4: Actions */}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={() => onTogglePause(torrent.hash, isPaused)}>
          {isPaused ? 'Riprendi' : 'Pausa'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDelete(torrent.hash, false)}>
          Rimuovi
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(torrent.hash, true)}>
          Elimina file
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update downloads page container**

Modify `app/downloads/page.tsx` — replace the `<table>` and `<tbody>` wrapper with a `<div>`:

Replace:
```tsx
      <table className="w-full">
        <tbody>
          {torrents.map(t => (
            <TorrentRow
              key={t.hash}
              torrent={t}
              onDelete={deleteTorrent}
              onTogglePause={togglePause}
              label={getLabel(t.hash)}
            />
          ))}
        </tbody>
      </table>
```

With:
```tsx
      <div className="space-y-4">
        {torrents.map(t => (
          <TorrentRow
            key={t.hash}
            torrent={t}
            onDelete={deleteTorrent}
            onTogglePause={togglePause}
            label={getLabel(t.hash)}
          />
        ))}
      </div>
```

- [ ] **Step 3: Run build to verify no type errors**

Run:
```bash
npx next build 2>&1 | head -30
```
Expected: Build completes without type errors

- [ ] **Step 4: Run all tests**

Run:
```bash
npx jest --verbose
```
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add components/TorrentRow.tsx app/downloads/page.tsx
git commit -m "feat: rewrite download page with card layout, extended data, and complete Italian status labels"
```

---

## Task 4: Movie Page — Add Remove/Unmonitor Actions

**Files:**
- Modify: `app/movies/page.tsx`

- [ ] **Step 1: Rewrite movies page with action menu**

Replace the entire content of `app/movies/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Film, MoreVertical, EyeOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Movie {
  id: number
  title: string
  year: number
  monitored: boolean
  hasFile: boolean
  images: { coverType: string; remoteUrl: string }[]
}

type Filter = 'all' | 'monitored' | 'missing' | 'downloaded'

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Tutti',
  monitored: 'Monitorati',
  missing: 'Mancanti',
  downloaded: 'Scaricati',
}

export default function MoviesPage() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/radarr/movie')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMovies(data)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = movies.filter(m => {
    if (filter === 'monitored') return m.monitored
    if (filter === 'missing') return m.monitored && !m.hasFile
    if (filter === 'downloaded') return m.hasFile
    return true
  })

  const unmonitor = async (id: number) => {
    setMenuOpen(null)
    try {
      const res = await fetch(`/api/radarr/movie/${id}`)
      const movie = await res.json()
      movie.monitored = false
      await fetch(`/api/radarr/movie/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movie),
      })
      setMovies(prev => prev.map(m => (m.id === id ? { ...m, monitored: false } : m)))
      toast.success('Monitoraggio disattivato')
    } catch {
      toast.error('Errore durante la disattivazione del monitoraggio')
    }
  }

  const deleteMovie = async (id: number) => {
    setConfirmDelete(null)
    setMenuOpen(null)
    try {
      await fetch(`/api/radarr/movie/${id}`, { method: 'DELETE' })
      setMovies(prev => prev.filter(m => m.id !== id))
      toast.success('Film rimosso dalla libreria')
    } catch {
      toast.error('Errore durante la rimozione del film')
    }
  }

  if (loading) return <p className="text-gray-500">Caricamento...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Film</h1>
        <span className="text-sm text-gray-400">{filtered.length} film</span>
      </div>

      <div className="flex gap-2">
        {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1 rounded ${
              filter === f ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filtered.map(movie => {
          const poster = movie.images.find(i => i.coverType === 'poster')
          return (
            <div
              key={movie.id}
              className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden relative group"
            >
              {poster ? (
                <img
                  src={poster.remoteUrl}
                  alt={movie.title}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-gray-800 flex items-center justify-center">
                  <Film size={32} className="text-gray-600" />
                </div>
              )}

              {/* Action menu trigger */}
              <button
                onClick={() => setMenuOpen(menuOpen === movie.id ? null : movie.id)}
                className="absolute top-2 right-2 p-1 rounded bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical size={16} />
              </button>

              {/* Dropdown menu */}
              {menuOpen === movie.id && (
                <div className="absolute top-9 right-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-[180px]">
                  <button
                    onClick={() => unmonitor(movie.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-t-lg"
                  >
                    <EyeOff size={14} />
                    Disattiva monitoraggio
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(null)
                      setConfirmDelete(movie.id)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-b-lg"
                  >
                    <Trash2 size={14} />
                    Elimina dalla libreria
                  </button>
                </div>
              )}

              <div className="p-2">
                <p className="text-sm font-semibold truncate">{movie.title}</p>
                <p className="text-xs text-gray-500">{movie.year}</p>
                <span
                  className={`text-xs ${
                    movie.hasFile
                      ? 'text-green-400'
                      : movie.monitored
                        ? 'text-yellow-400'
                        : 'text-gray-500'
                  }`}
                >
                  {movie.hasFile
                    ? 'Scaricato'
                    : movie.monitored
                      ? 'Mancante'
                      : 'Non monitorato'}
                </span>
              </div>

              {/* Delete confirmation modal */}
              {confirmDelete === movie.id && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 z-20">
                  <p className="text-sm text-center mb-3">
                    Sei sicuro? Il film verrà rimosso da Radarr. Questa azione è irreversibile.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={() => deleteMovie(movie.id)}
                      className="px-3 py-1 text-sm rounded bg-red-600 text-white"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | head -30
```
Expected: Build completes without errors

- [ ] **Step 3: Commit**

```bash
git add app/movies/page.tsx
git commit -m "feat: add unmonitor and delete actions to movie cards"
```

---

## Task 5: Series Page — Add Remove/Unmonitor Actions

**Files:**
- Modify: `app/series/page.tsx`

- [ ] **Step 1: Rewrite series page with action buttons**

Replace the entire content of `app/series/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Tv, ChevronDown, ChevronRight, EyeOff, Trash2 } from 'lucide-react'
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
  seasonNumber: number
  episodeNumber: number
  title: string
  hasFile: boolean
  monitored: boolean
}

export default function SeriesPage() {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/sonarr/series')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSeries(data)
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = async (id: number) => {
    if (expanded === id) {
      setExpanded(null)
      return
    }
    setExpanded(id)
    const data = await fetch(`/api/sonarr/episode?seriesId=${id}`).then(r => r.json())
    if (Array.isArray(data)) setEpisodes(data)
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
    setConfirmDelete(null)
    try {
      await fetch(`/api/sonarr/series/${id}?deleteFiles=false`, { method: 'DELETE' })
      setSeries(prev => prev.filter(s => s.id !== id))
      toast.success('Serie rimossa dalla libreria')
    } catch {
      toast.error('Errore durante la rimozione della serie')
    }
  }

  if (loading) return <p className="text-gray-500">Caricamento...</p>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Serie TV</h1>
      {series.length === 0 && <p className="text-gray-500">Nessuna serie in libreria.</p>}
      <div className="space-y-2">
        {series.map(s => {
          const poster = s.images.find(i => i.coverType === 'poster')
          const isExpanded = expanded === s.id
          return (
            <div key={s.id} className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="flex items-center">
                <button
                  onClick={() => toggleExpand(s.id)}
                  className="flex-1 flex items-center gap-3 p-3 text-left"
                >
                  {poster ? (
                    <img
                      src={poster.remoteUrl}
                      alt={s.title}
                      className="w-10 h-14 object-cover rounded"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-gray-800 rounded flex items-center justify-center">
                      <Tv size={16} className="text-gray-600" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{s.title}</p>
                    <p className="text-xs text-gray-500">
                      {s.year} &mdash; {s.statistics.seasonCount} stagioni &mdash;{' '}
                      {s.statistics.episodeFileCount}/{s.statistics.episodeCount} episodi
                      {!s.monitored && (
                        <span className="ml-2 text-gray-500">(Non monitorata)</span>
                      )}
                    </p>
                  </div>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {/* Action buttons */}
                <div className="flex items-center gap-1 pr-3">
                  <button
                    onClick={e => unmonitor(e, s.id)}
                    className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-yellow-400 transition-colors"
                    title="Disattiva monitoraggio"
                  >
                    <EyeOff size={16} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setConfirmDelete(s.id)
                    }}
                    className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-red-400 transition-colors"
                    title="Elimina dalla libreria"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Delete confirmation */}
              {confirmDelete === s.id && (
                <div className="border-t border-gray-800 p-3 bg-red-900/10 flex items-center justify-between">
                  <p className="text-sm text-red-300">
                    Sei sicuro? La serie verrà rimossa da Sonarr.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={() => deleteSeries(s.id)}
                      className="px-3 py-1 text-sm rounded bg-red-600 text-white"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              )}

              {isExpanded && (
                <div className="border-t border-gray-800 p-3 space-y-1">
                  {episodes.map(ep => (
                    <div key={ep.id} className="flex items-center gap-2 text-sm">
                      <span className={ep.hasFile ? 'text-green-400' : 'text-gray-500'}>
                        {ep.hasFile ? '\u25CF' : '\u25CB'}
                      </span>
                      <span className="text-gray-400">
                        S{String(ep.seasonNumber).padStart(2, '0')}E
                        {String(ep.episodeNumber).padStart(2, '0')}
                      </span>
                      <span>{ep.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | head -30
```
Expected: Build completes without errors

- [ ] **Step 3: Commit**

```bash
git add app/series/page.tsx
git commit -m "feat: add unmonitor and delete actions to series rows"
```

---

## Task 6: Dashboard Chart Components

**Files:**
- Create: `components/charts/LibraryDonut.tsx`
- Create: `components/charts/DiskSpaceDonut.tsx`
- Create: `components/charts/MonthlyAdditions.tsx`

- [ ] **Step 1: Create LibraryDonut component**

Create `components/charts/LibraryDonut.tsx`:

```tsx
'use client'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface Props {
  downloaded: number
  missing: number
  unmonitored: number
}

const COLORS = ['#22c55e', '#eab308', '#6b7280']

export function LibraryDonut({ downloaded, missing, unmonitored }: Props) {
  const total = downloaded + missing + unmonitored
  const data = [
    { name: 'Scaricati', value: downloaded },
    { name: 'Mancanti', value: missing },
    { name: 'Non monitorati', value: unmonitored },
  ]

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Stato Libreria</h3>
      <div className="flex flex-col items-center gap-3">
        <div className="w-24 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={28}
                outerRadius={42}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-2xl font-bold">{total}</div>
        <div className="text-xs space-y-1 w-full">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                {d.name}
              </span>
              <span className="text-gray-400">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create DiskSpaceDonut component**

Create `components/charts/DiskSpaceDonut.tsx`:

```tsx
'use client'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface Props {
  movieSize: number
  seriesSize: number
  freeSpace: number
}

const COLORS = ['#3b82f6', '#a855f7', '#374151']

function formatTB(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(0)} GB`
  return `${(bytes / 1e6).toFixed(0)} MB`
}

export function DiskSpaceDonut({ movieSize, seriesSize, freeSpace }: Props) {
  const totalUsed = movieSize + seriesSize
  const totalDisk = totalUsed + freeSpace
  const data = [
    { name: 'Film', value: movieSize },
    { name: 'Serie TV', value: seriesSize },
    { name: 'Libero', value: freeSpace },
  ]

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Spazio Disco</h3>
      <div className="flex items-center justify-center gap-6">
        <div className="w-28 h-28 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={34}
                outerRadius={50}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold">{formatTB(totalUsed)}</span>
            <span className="text-[10px] text-gray-400">/ {formatTB(totalDisk)}</span>
          </div>
        </div>
        <div className="text-xs space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
              <span className="text-gray-300">{d.name}</span>
              <span className="text-gray-500">{formatTB(d.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create MonthlyAdditions component**

Create `components/charts/MonthlyAdditions.tsx`:

```tsx
'use client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface Props {
  data: { month: string; count: number }[]
}

export function MonthlyAdditions({ data }: Props) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Aggiunte Mensili</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="month"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#d1d5db' }}
              itemStyle={{ color: '#3b82f6' }}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Aggiunti" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

Run:
```bash
npx next build 2>&1 | head -30
```
Expected: Build completes without errors

- [ ] **Step 5: Commit**

```bash
git add components/charts/
git commit -m "feat: add Recharts dashboard components (library donut, disk space, monthly additions)"
```

---

## Task 7: Dashboard Page Overhaul

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Rewrite dashboard with hero+sidebar layout**

Replace the entire content of `app/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Film, Tv, Download, HardDrive } from 'lucide-react'
import { LibraryDonut } from '@/components/charts/LibraryDonut'
import { DiskSpaceDonut } from '@/components/charts/DiskSpaceDonut'
import { MonthlyAdditions } from '@/components/charts/MonthlyAdditions'

interface HealthStatus {
  radarr: boolean
  sonarr: boolean
  prowlarr: boolean
  qbittorrent: boolean
}

interface CalendarItem {
  title: string
  airDateUtc?: string
  inCinemas?: string
  hasFile: boolean
}

interface DownloadItem {
  name: string
  progress: number
}

interface Movie {
  hasFile: boolean
  monitored: boolean
  sizeOnDisk: number
  added: string
}

interface SeriesItem {
  monitored: boolean
  statistics: { episodeFileCount: number; episodeCount: number; sizeOnDisk: number }
  added: string
}

interface DiskSpace {
  path: string
  freeSpace: number
  totalSpace: number
}

const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function computeMonthlyData(movies: Movie[], series: SeriesItem[]) {
  const counts: Record<string, number> = {}
  const now = new Date()

  // Last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    counts[key] = 0
  }

  for (const m of movies) {
    if (!m.added) continue
    const key = m.added.slice(0, 7) // "YYYY-MM"
    if (key in counts) counts[key]++
  }

  for (const s of series) {
    if (!s.added) continue
    const key = s.added.slice(0, 7)
    if (key in counts) counts[key]++
  }

  return Object.entries(counts).map(([key, count]) => ({
    month: MONTH_NAMES[parseInt(key.split('-')[1]) - 1],
    count,
  }))
}

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [movies, setMovies] = useState<Movie[]>([])
  const [series, setSeries] = useState<SeriesItem[]>([])
  const [calendar, setCalendar] = useState<CalendarItem[]>([])
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [diskSpace, setDiskSpace] = useState<DiskSpace[]>([])

  useEffect(() => {
    fetch('/api/system/health').then(r => r.json()).then(setHealth).catch(() => {})
    fetch('/api/radarr/movie')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMovies(d) })
      .catch(() => {})
    fetch('/api/sonarr/series')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSeries(d) })
      .catch(() => {})
    fetch('/api/radarr/diskspace')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDiskSpace(d) })
      .catch(() => {})

    const now = new Date()
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const params = `?start=${now.toISOString()}&end=${end.toISOString()}`
    Promise.all([
      fetch(`/api/radarr/calendar${params}`).then(r => r.json()).catch(() => []),
      fetch(`/api/sonarr/calendar${params}`).then(r => r.json()).catch(() => []),
    ]).then(([m, s]) => {
      const all = [
        ...(Array.isArray(m) ? m : []),
        ...(Array.isArray(s) ? s : []),
      ]
      setCalendar(all.slice(0, 7))
    })

    const es = new EventSource('/api/stream')
    es.onmessage = e => {
      const data = JSON.parse(e.data)
      if (Array.isArray(data)) {
        setDownloads(data.map((t: { name: string; progress: number }) => ({
          name: t.name,
          progress: t.progress,
        })))
      }
    }
    return () => es.close()
  }, [])

  // Library stats
  const movieDownloaded = movies.filter(m => m.hasFile).length
  const movieMissing = movies.filter(m => m.monitored && !m.hasFile).length
  const movieUnmonitored = movies.filter(m => !m.monitored).length
  const seriesFullyDownloaded = series.filter(s => s.statistics.episodeFileCount === s.statistics.episodeCount && s.statistics.episodeCount > 0).length
  const seriesMissing = series.filter(s => s.monitored && s.statistics.episodeFileCount < s.statistics.episodeCount).length
  const seriesUnmonitored = series.filter(s => !s.monitored).length

  const totalDownloaded = movieDownloaded + seriesFullyDownloaded
  const totalMissing = movieMissing + seriesMissing
  const totalUnmonitored = movieUnmonitored + seriesUnmonitored

  // Disk stats
  const movieSizeTotal = movies.reduce((sum, m) => sum + (m.sizeOnDisk || 0), 0)
  const seriesSizeTotal = series.reduce((sum, s) => sum + (s.statistics?.sizeOnDisk || 0), 0)
  const disk = diskSpace[0]
  const freeSpace = disk?.freeSpace ?? 0

  // Monthly data
  const monthlyData = computeMonthlyData(movies, series)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-[2fr_1fr] gap-6">
        {/* Left column (hero) */}
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={Film} label="Film" value={movies.length} />
            <StatCard icon={Tv} label="Serie TV" value={series.length} />
            <StatCard icon={Download} label="Download" value={downloads.length} />
            <StatCard
              icon={HardDrive}
              label="Servizi"
              value={health ? Object.values(health).filter(Boolean).length : 0}
              suffix="/4"
            />
          </div>

          {/* Disk space - large */}
          {disk && (
            <DiskSpaceDonut
              movieSize={movieSizeTotal}
              seriesSize={seriesSizeTotal}
              freeSpace={freeSpace}
            />
          )}

          {/* Monthly additions - large */}
          <MonthlyAdditions data={monthlyData} />
        </div>

        {/* Right column (sidebar) */}
        <div className="space-y-6">
          {/* Library status donut */}
          <LibraryDonut
            downloaded={totalDownloaded}
            missing={totalMissing}
            unmonitored={totalUnmonitored}
          />

          {/* Service status */}
          {health && (
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Stato Servizi</h3>
              <div className="space-y-2">
                {Object.entries(health).map(([name, ok]) => (
                  <div key={name} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="text-gray-300">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming releases */}
          {calendar.length > 0 && (
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Prossime Uscite</h3>
              <div className="space-y-1.5">
                {calendar.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={item.hasFile ? 'text-green-400' : 'text-gray-500'}>
                      {item.hasFile ? '\u25CF' : '\u25CB'}
                    </span>
                    <span className="text-gray-300 truncate">{item.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active downloads */}
          {downloads.length > 0 && (
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Download Attivi</h3>
              <div className="space-y-3">
                {downloads.map((d, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs truncate flex-1 text-gray-300">{d.name}</span>
                      <span className="text-xs text-purple-400 ml-2">
                        {Math.round(d.progress * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full">
                      <div
                        className="bg-purple-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.round(d.progress * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: React.ElementType
  label: string
  value: number
  suffix?: string
}) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
        <Icon size={14} />
        {label}
      </div>
      <div className="text-2xl font-bold">
        {value}
        {suffix}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | head -30
```
Expected: Build completes without errors

- [ ] **Step 3: Run all tests**

Run:
```bash
npx jest --verbose
```
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: overhaul dashboard with hero+sidebar layout, charts, and disk space widget"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

Run:
```bash
npx jest --verbose
```
Expected: All tests pass

- [ ] **Step 2: Run production build**

Run:
```bash
npx next build
```
Expected: Build succeeds with no errors

- [ ] **Step 3: Run lint**

Run:
```bash
npx eslint . 2>&1 | tail -5
```
Expected: No errors (warnings acceptable)
