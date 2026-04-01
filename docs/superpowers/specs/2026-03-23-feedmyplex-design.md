# FeedMyPlex — Design Spec

**Date:** 2026-03-23
**Status:** Approved

## Overview

FeedMyPlex is a self-hosted web application that lets a user search for torrents via Jackett (multi-provider aggregator), send them to qBittorrent for download into a Plex-linked folder, and manage the resulting video files through a clean UI. Non-video files are cleaned up automatically after each download completes.

---

## Goals

- Search torrents from multiple providers through a single interface (Jackett)
- Send magnet links to qBittorrent with one click
- Monitor download progress in real time
- Automatically clean up non-video files after download completes
- Allow the user to delete video files from the Plex folder via the UI
- Configure all settings (paths, credentials) from within the app

## Non-Goals

- Subtitle management or media metadata enrichment (e.g. Sonarr/Radarr features)
- User authentication / multi-user support
- Mobile-optimised layout
- Cloud storage integration

---

## Architecture

### Runtime

A single **Next.js 15** process (App Router) serves both the frontend and backend. No separate processes are required. An optional `docker-compose.yml` can orchestrate qBittorrent, Jackett, and the app together.

### External Dependencies

| Service | Role | Integration method |
|---|---|---|
| **Jackett** | Multi-tracker torrent search aggregator | HTTP REST API (`/api/v2.0/indexers/all/results`) |
| **qBittorrent** | Torrent client | HTTP Web API (`/api/v2/*`) |

Both services are assumed to be already installed and reachable on the local network. Their URLs and credentials are configured in the app's Settings page and stored in `config.json`.

### API Routes

| Route | Method | Description |
|---|---|---|
| `/api/search` | GET | Proxy search query to Jackett; return normalised results |
| `/api/torrents` | GET | List active torrents from qBittorrent |
| `/api/torrents` | POST | Add a torrent by magnet link to qBittorrent |
| `/api/torrents/[hash]` | DELETE | Remove a torrent (optionally delete files) |
| `/api/stream` | GET | SSE endpoint; pushes torrent state updates every 2 s |
| `/api/library` | GET | List video files in the configured Plex folder |
| `/api/library/[filename]` | DELETE | Delete a specific file from the Plex folder |
| `/api/config` | GET/PUT | Read and write `config.json` |
| `/api/test/jackett` | GET | Test connectivity to Jackett using saved config |
| `/api/test/qbittorrent` | GET | Test connectivity to qBittorrent using saved config |

### Real-Time Updates

The `/api/stream` endpoint uses **Server-Sent Events (SSE)**. It polls qBittorrent every 2 seconds and pushes torrent state (name, progress, speed, ETA, status) as `text/event-stream`. The frontend subscribes with the native `EventSource` API. No WebSocket library is needed.

### Configuration Persistence

Settings are stored in a local `config.json` file at the project root (excluded from version control). The file contains:

```json
{
  "plexFolder": "/mnt/media/plex",
  "jackett": {
    "url": "http://localhost:9117",
    "apiKey": "..."
  },
  "qbittorrent": {
    "url": "http://localhost:8080",
    "username": "admin",
    "password": "..."
  }
}
```

On first run, if `config.json` does not exist, the app redirects to the Settings page.

---

## UI

### Layout

**Sidebar + main content** — fixed left sidebar with the app logo and four navigation links. The main content area renders the active section.

### Sidebar Navigation

- 🔍 Cerca (Search)
- ⬇️ Download
- 📁 Libreria (Library)
- ⚙️ Impostazioni (Settings)

### Search Page

- Text input + "Cerca" button
- Results render as a **compact table**: columns are Nome, Dimensione, Seeders, Categoria, action button
- Each row has a "Scarica" (Download) button; clicking it POSTs the magnet link to `/api/torrents` and shows a toast notification confirming the torrent was added
- Table is sortable by Seeders and Dimensione
- Results show a badge for resolution if detectable from the title (e.g. 1080p, 4K)

### Download Page

- Live list of active torrents, updated via SSE
- Each entry shows: torrent name, progress bar, percentage, downloaded/total size, speed, ETA, status label (downloading / seeding / paused / error)
- Action buttons: Pause/Resume, Delete torrent, Delete torrent + files

### Library Page

- Table of video files found in the configured Plex folder
- Columns: filename, size, last modified date, action
- Each row has a "Elimina" (Delete) button with a confirmation dialog before deletion
- Supported extensions: `.mkv`, `.mp4`, `.avi`, `.mov`, `.ts`, `.m4v`

### Settings Page

- Form fields for: Plex folder path, Jackett URL, Jackett API key, qBittorrent URL, username, password
- "Salva" button writes to `/api/config`
- Connection test buttons for Jackett and qBittorrent — each button calls `/api/test/jackett` or `/api/test/qbittorrent` server-side using the currently saved config, and returns success/error. Credentials never leave the server.

---

## Automatic File Cleanup

Cleanup runs **server-side unconditionally** — not triggered by a client connection. The SSE polling loop in `/api/stream` runs every 2 seconds on the server regardless of whether any browser is connected. When it detects a torrent transitioning to the `complete` state, it triggers the cleanup routine. This means cleanup fires even if the user closes the browser mid-download.

After qBittorrent marks a torrent as complete, the cleanup routine:

1. Enumerate all files in the torrent's download directory
2. Move files with video extensions (`.mkv`, `.mp4`, `.avi`, `.mov`, `.ts`, `.m4v`) to the configured Plex folder
3. Delete all remaining files and the (now-empty) torrent directory
4. Log the cleanup result

The cleanup is idempotent — if the Plex folder already contains a file with the same name, the incoming file is renamed with a numeric suffix to avoid collision.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) | Full-stack, SSE support, single process |
| Styling | Tailwind CSS + shadcn/ui | Dark theme, accessible components out of the box |
| Real-time | SSE via native `EventSource` | Simpler than WebSocket, sufficient for one-way status stream |
| HTTP client | Native `fetch` (Node 18+) | No extra dependency |
| Config storage | `config.json` (fs read/write) | No database needed for single-user app |
| Containerisation | `docker-compose.yml` (optional) | Easy local deployment with qBittorrent + Jackett |

---

## File Structure

```
feed-my-plex/
├── app/
│   ├── layout.tsx          # Root layout with sidebar
│   ├── page.tsx            # Redirect to /search
│   ├── search/page.tsx
│   ├── downloads/page.tsx
│   ├── library/page.tsx
│   ├── settings/page.tsx
│   └── api/
│       ├── search/route.ts
│       ├── torrents/route.ts
│       ├── torrents/[hash]/route.ts
│       ├── stream/route.ts
│       ├── library/route.ts
│       ├── library/[filename]/route.ts
│       ├── config/route.ts
│       └── test/
│           ├── jackett/route.ts
│           └── qbittorrent/route.ts
├── components/
│   ├── Sidebar.tsx
│   ├── TorrentTable.tsx
│   ├── SearchResults.tsx
│   ├── LibraryTable.tsx
│   └── StatusToast.tsx
├── lib/
│   ├── jackett.ts          # Jackett API client
│   ├── qbittorrent.ts      # qBittorrent API client
│   ├── config.ts           # config.json read/write helpers
│   └── cleanup.ts          # Post-download file cleanup logic
├── config.json             # Runtime config (gitignored)
├── docker-compose.yml
└── .gitignore
```

---

## Error Handling

- If Jackett is unreachable, the Search page shows an inline error with a link to Settings
- If qBittorrent is unreachable, the Download page shows a connection error banner
- If `config.json` is missing or incomplete, all pages redirect to Settings
- File deletion errors (permissions, not found) are surfaced as toast notifications
- SSE connection drops are retried automatically by `EventSource` (browser native behaviour)
