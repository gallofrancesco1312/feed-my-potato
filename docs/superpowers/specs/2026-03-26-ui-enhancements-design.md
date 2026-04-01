# UI Enhancements — Design Specification

**Date**: 2026-03-26
**Status**: Approved

## Overview

Three feature sets to enhance the feed-my-plex application:
1. Remove missing movies/series from library
2. Dashboard overhaul with charts and disk space widget
3. Download page improvements with extended data and complete Italian status labels

---

## Feature 1: Remove Missing Movies/Series

### Movies Page (`/movies`)

Each movie card gains a context menu (triggered by `MoreVertical` icon, visible on hover or always visible in "Mancanti" filter) with two actions:

- **"Disattiva monitoraggio"**: Fetches the full movie object via `GET /api/radarr/movie/{id}`, sets `monitored: false`, then sends the full object back via `PUT /api/radarr/movie/{id}`. Updates card state in-place (status changes from "Mancante" to "Non monitorato"). Toast confirmation on success.
- **"Elimina dalla libreria"**: Calls `DELETE /api/radarr/movie/{id}`. Shows confirmation dialog ("Sei sicuro? Il film verrà rimosso da Radarr. Questa azione è irreversibile."). On confirm, removes card from list with toast confirmation.

Actions are available on all cards regardless of filter, but are most useful in the "Mancanti" view.

### Series Page (`/series`)

Each series row gains action buttons (right-aligned, same style as the expand chevron area) with the same two actions:

- **"Disattiva monitoraggio"**: Fetches the full series object via `GET /api/sonarr/series/{id}`, sets `monitored: false`, then sends the full object back via `PUT /api/sonarr/series/{id}`. Updates row state in-place.
- **"Elimina dalla libreria"**: Calls `DELETE /api/sonarr/series/{id}` with `?deleteFiles=false`. Confirmation dialog required. Removes row from list.

Actions apply to the entire series only, not individual episodes.

### New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/api/radarr/movie/[id]` | Update movie (e.g., toggle `monitored`) |
| `DELETE` | `/api/radarr/movie/[id]` | Delete movie from Radarr |
| `PUT` | `/api/sonarr/series/[id]` | Update series (e.g., toggle `monitored`) |
| `DELETE` | `/api/sonarr/series/[id]` | Delete series from Sonarr |

All endpoints follow the existing `arrProxy()` pattern used by other API routes.

---

## Feature 2: Dashboard Overhaul

### Layout: Hero + Sidebar (Option B)

Two-column layout with `grid-template-columns: 2fr 1fr`:

**Left column (hero):**
1. **Stat cards row** — 4 cards in a row (Film count, Serie TV count, Download count, Servizi health). Identical to current implementation.
2. **Disk space widget** — Large donut chart showing used vs free space, with breakdown legend (Film size, Serie size, Free). Data from `/api/radarr/diskspace` for total/free and from movie/series `sizeOnDisk` fields for the breakdown.
3. **Monthly additions chart** — Bar chart showing items added per month over the last 6 months. Uses `added` field from Radarr movies and Sonarr series, grouped by month.

**Right column (sidebar):**
1. **Library status donut** — Donut chart showing distribution: Scaricati (green), Mancanti (yellow), Non monitorati (gray). Counts from movies + series combined.
2. **Service status** — Vertical list with colored dots (green/red) per service.
3. **Upcoming releases** — Next 7 calendar items with download status indicator.
4. **Active downloads** — Compact progress bars (name + percentage), real-time via SSE.

### Charting Library

**Recharts** — install as dependency. Components used:
- `PieChart` + `Pie` + `Cell` for donut charts (disk space, library status)
- `BarChart` + `Bar` for monthly additions
- `ResponsiveContainer` for responsive sizing

### Data Sources

| Widget | API Endpoint | Fields Used |
|--------|-------------|-------------|
| Stat cards | `/api/radarr/movie`, `/api/sonarr/series`, `/api/stream`, `/api/system/health` | Array length, health booleans |
| Disk space donut | `/api/radarr/diskspace` | `totalSpace`, `freeSpace` |
| Disk breakdown | `/api/radarr/movie`, `/api/sonarr/series` | `sizeOnDisk`, `statistics.sizeOnDisk` |
| Library status donut | `/api/radarr/movie`, `/api/sonarr/series` | `hasFile`, `monitored` |
| Monthly additions | `/api/radarr/movie`, `/api/sonarr/series` | `added` (ISO date string) |
| Service status | `/api/system/health` | Boolean per service |
| Upcoming | `/api/radarr/calendar`, `/api/sonarr/calendar` | `title`, `hasFile`, date fields |
| Active downloads | `/api/stream` (SSE) | `name`, `progress` |

### Color Palette (consistent with existing dark theme)

- Film: `#3b82f6` (blue-500)
- Serie TV: `#a855f7` (purple-500)
- Scaricati: `#22c55e` (green-500)
- Mancanti: `#eab308` (yellow-500)
- Non monitorati: `#6b7280` (gray-500)
- Spazio libero: `#374151` (gray-700)
- Errore: `#ef4444` (red-500)

---

## Feature 3: Download Page Improvements

### Extended Torrent Interface

Add fields to the `Torrent` TypeScript interface in `lib/qbittorrent.ts`:

```typescript
export interface Torrent {
  hash: string
  name: string
  progress: number
  dlspeed: number
  upspeed: number        // NEW
  eta: number
  size: number
  total_size: number     // NEW
  uploaded: number       // NEW
  downloaded: number     // NEW
  ratio: number          // NEW
  num_seeds: number      // NEW
  num_leechs: number     // NEW
  added_on: number       // NEW (unix timestamp)
  tracker: string        // NEW
  category: string       // NEW
  state: string
  savePath: string
  contentPath: string
}
```

These fields are all returned by qBittorrent's `/api/v2/torrents/info` endpoint — no API changes needed.

### TorrentRow Layout: Card-based

Replace the current table row (`<tr>`) with a card layout (`<div>`) per torrent. The parent `downloads/page.tsx` must also change from `<table><tbody>` to a `<div>` container with `space-y` gap:

- **Row 1**: Name (truncated) + Badge stato (colored) + Badge categoria (Film blue / Serie green)
- **Row 2**: Full-width progress bar with percentage
- **Row 3**: Metadata grid with small labels:
  - Dimensione: formatted total_size (e.g., "4.2 GB")
  - Seed/Peer: `{num_seeds} seed · {num_leechs} peer`
  - Ratio: formatted ratio (e.g., "1.35")
  - Velocità DL: formatted dlspeed
  - Velocità UP: formatted upspeed
  - ETA: formatted eta
  - Aggiunto il: formatted added_on as Italian date (e.g., "25 mar 2026")
  - Tracker: hostname extracted from tracker URL
- **Row 4**: Action buttons (Pausa/Riprendi, Rimuovi, Elimina file) — same as current

### Complete Italian Status Labels with Color Families

```typescript
interface StateConfig {
  label: string
  color: 'blue' | 'green' | 'yellow' | 'gray' | 'red'
}

const STATE_MAP: Record<string, StateConfig> = {
  // Download (blue)
  downloading:          { label: 'Scaricando',            color: 'blue' },
  forcedDL:             { label: 'Download forzato',      color: 'blue' },
  metaDL:               { label: 'Scaricando metadati',   color: 'blue' },

  // Waiting/Queued (yellow)
  stalledDL:            { label: 'In attesa (download)',   color: 'yellow' },
  queuedDL:             { label: 'In coda (download)',     color: 'yellow' },
  allocating:           { label: 'Allocazione spazio',     color: 'yellow' },

  // Seeding (green)
  uploading:            { label: 'In seeding',             color: 'green' },
  stalledUP:            { label: 'In seeding',             color: 'green' },
  forcedUP:             { label: 'Seeding forzato',        color: 'green' },
  queuedUP:             { label: 'In coda (seeding)',      color: 'green' },

  // Paused/Checking (gray)
  pausedDL:             { label: 'In pausa',               color: 'gray' },
  pausedUP:             { label: 'In pausa (completo)',    color: 'gray' },
  checkingDL:           { label: 'Verifica file',          color: 'gray' },
  checkingUP:           { label: 'Verifica file',          color: 'gray' },
  checkingResumeData:   { label: 'Verifica ripresa',       color: 'gray' },
  moving:               { label: 'Spostamento file',       color: 'gray' },

  // Error (red)
  error:                { label: 'Errore',                 color: 'red' },
  missingFiles:         { label: 'File mancanti',          color: 'red' },
  unknown:              { label: 'Sconosciuto',            color: 'gray' },
}
```

Badge color mapping (Tailwind classes):
- `blue`: `bg-blue-900/30 text-blue-400`
- `green`: `bg-green-900/30 text-green-400`
- `yellow`: `bg-yellow-900/30 text-yellow-400`
- `gray`: `bg-gray-700/30 text-gray-400`
- `red`: `bg-red-900/30 text-red-400`

### Formatting Utilities

- `formatSize(bytes)`: "4.2 GB", "850 MB", "1.2 TB"
- `formatDate(unixTimestamp)`: Italian locale date "25 mar 2026"
- `extractTrackerHost(url)`: Extract hostname from tracker URL
- Existing `formatSpeed()` and `formatEta()` remain unchanged

---

## Dependencies

### New npm packages
- `recharts` — charting library for dashboard donut and bar charts

### No new services
All data comes from existing Radarr, Sonarr, and qBittorrent APIs already configured in the stack.

---

## Out of Scope

- Editing movie/series metadata (quality profiles, root folders)
- Historical download statistics or bandwidth monitoring
- Multi-disk/partition management
- Internationalization framework (labels remain hardcoded Italian strings)
- Episode-level removal (only whole series removal supported)
