# Interactive Torrent Search — Design Spec

## Goal

Replace the current "add and auto-search" workflow with an interactive torrent selection experience. When a user searches for a movie or series, they can expand a result to browse available torrents (name, seeders, quality, etc.) and manually pick which one to download.

## Architecture

The search page gains an accordion pattern: clicking a search result expands it inline to show available torrents. For movies the torrent list appears directly; for series an intermediate episode list (grouped by season) lets the user drill down to per-episode torrents. Torrent data comes from Radarr/Sonarr's `/api/v3/release` endpoint, which requires the item to be in the library — so items are auto-added (without auto-search) on first expand. Every user action triggers a toast notification via sonner.

## Tech Stack

- Next.js 16 (App Router, React 19)
- Radarr/Sonarr v3 release API
- Existing `arrProxy` / `arrFetch` pattern for new endpoints
- Sonner for toast notifications (already configured)
- Tailwind CSS + shadcn/Base UI components

---

## User Flow

### Film

1. User searches for a title → lookup results appear as cards (existing behavior).
2. User clicks a card → accordion expands below it.
3. If the film is **not yet in the library**, it is added automatically (`monitored: true`, `addOptions: { searchForMovie: false }`). A toast confirms: "Film aggiunto alla libreria".
4. Releases are fetched via `GET /api/radarr/release?movieId={id}`. A loading spinner shows during fetch.
5. A **ReleaseTable** appears with all available torrents, sorted by seeders descending.
6. User clicks the download button on a row → `POST /api/radarr/release` with `{ guid, indexerId }`. Toast confirms: "Download avviato: {torrent name}".
7. User can collapse the accordion and expand another result.

### Serie TV

1. Same search and card display as film.
2. User clicks a series card → accordion expands.
3. If the series is **not yet in the library**, it is added automatically (`monitored: true`, `addOptions: { searchForMissingEpisodes: false }`). Toast confirms: "Serie aggiunta alla libreria".
4. Episodes are fetched via `GET /api/sonarr/episode?seriesId={id}`.
5. An **EpisodeList** appears, episodes grouped by season with collapsible season headers.
6. User clicks an episode → a nested accordion expands with a **ReleaseTable** for that episode, fetched via `GET /api/sonarr/release?episodeId={id}`.
7. User clicks download → `POST /api/sonarr/release` with `{ guid, indexerId }`. Toast confirms: "Download avviato: {torrent name}".

### Error Handling

- API errors during add-to-library → `toast.error("Errore nell'aggiunta alla libreria: {message}")`, accordion does not expand.
- API errors during release fetch → `toast.error("Errore nella ricerca torrent: {message}")`, empty state shown.
- API errors during grab → `toast.error("Errore nel download: {message}")`, button resets to idle.
- Network timeouts → release search uses 30s timeout (consistent with existing lookup endpoints).

---

## API Endpoints

### New Endpoints (4 routes)

#### `GET /api/radarr/release`

Proxies to `GET /api/v3/release?movieId={movieId}` on Radarr. Returns array of release objects.

Query params: `movieId` (required).

#### `POST /api/radarr/release`

Proxies to `POST /api/v3/release` on Radarr. Grabs a specific release.

Body: `{ guid: string, indexerId: number }`.

#### `GET /api/sonarr/release`

Proxies to `GET /api/v3/release?episodeId={episodeId}` on Sonarr. Returns array of release objects.

Query params: `episodeId` (required).

#### `POST /api/sonarr/release`

Proxies to `POST /api/v3/release` on Sonarr. Grabs a specific release.

Body: `{ guid: string, indexerId: number }`.

### Existing Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /api/radarr/lookup?term=` | Search movie titles |
| `GET /api/sonarr/lookup?term=` | Search series titles |
| `POST /api/radarr/movie` | Add movie to library |
| `POST /api/sonarr/series` | Add series to library |
| `GET /api/sonarr/episode?seriesId=` | Fetch episodes for a series |
| `GET /api/radarr/qualityprofile` | Quality profiles for add |
| `GET /api/sonarr/qualityprofile` | Quality profiles for add |
| `GET /api/radarr/rootfolder` | Root folders for add |
| `GET /api/sonarr/rootfolder` | Root folders for add |

---

## Components

### SearchPage (modify existing)

File: `app/search/page.tsx`

Responsibilities:
- Orchestrates search, results, and expanded state.
- Tracks which card is currently expanded (only one at a time).
- Passes callbacks for add-to-library and release-fetch to child components.

State changes:
- `expandedIndex: number | null` — which result card is expanded.
- Remove inline `addItem` logic; delegate to `SearchResultCard`.

### SearchResultCard (new)

File: `components/SearchResultCard.tsx`

Props:
- `item: LookupResult` — search result data.
- `isExpanded: boolean` — whether accordion is open.
- `onToggle: () => void` — click handler to expand/collapse.

Responsibilities:
- Renders the card (poster, title, year, overview, type badge) — extracted from current inline JSX.
- When expanded:
  - Auto-adds item to library if not already present (checks `item.id`).
  - For movies: fetches releases → renders `ReleaseTable`.
  - For series: fetches episodes → renders `EpisodeList`.
- Manages loading/error state for the expanded section.
- Fires toast notifications for add-to-library and errors.

### ReleaseTable (new)

File: `components/ReleaseTable.tsx`

Props:
- `releases: Release[]` — array of release objects from API.
- `onGrab: (guid: string, indexerId: number) => Promise<void>` — grab handler.

Responsibilities:
- Renders a table with columns: Nome, Qualità, Lingua, Indexer, Età, Dimensione, Seed, Leech, Azione.
- Default sort: seeders descending.
- Clickable column headers to change sort field and direction.
- Download button per row with states: idle (arrow icon), loading (spinner), done (check icon).
- Fires `toast.success` on successful grab, `toast.error` on failure.

Release object fields used (from Radarr/Sonarr API):
- `title` (string) — torrent name
- `quality.quality.name` (string) — e.g. "WEBDL-1080p"
- `languages` (array) — e.g. `[{ id: 1, name: "English" }]`
- `indexer` (string) — indexer name
- `age` (number) — days since publication
- `size` (number) — bytes
- `seeders` (number)
- `leechers` (number)
- `guid` (string) — unique release identifier for grab
- `indexerId` (number) — indexer ID for grab

### EpisodeList (new)

File: `components/EpisodeList.tsx`

Props:
- `seriesId: number` — ID of the series in Sonarr library.

Responsibilities:
- Fetches episodes from `GET /api/sonarr/episode?seriesId={id}`.
- Groups episodes by `seasonNumber`.
- Renders collapsible season headers ("Stagione 1", "Stagione 2", etc.).
- Under each season: rows with episode number, title, air date.
- Click on an episode row → expands a nested `ReleaseTable` for that episode.
- Only one episode's releases are expanded at a time.
- Fetches releases on demand: `GET /api/sonarr/release?episodeId={id}`.

---

## Toast Notifications

All toasts use sonner (already configured in layout via `<Toaster />`).

| Action | Type | Message |
|--------|------|---------|
| Film added to library | `toast.success` | "Film aggiunto alla libreria" |
| Series added to library | `toast.success` | "Serie aggiunta alla libreria" |
| Release search started | `toast.loading` | "Ricerca torrent in corso..." |
| Grab successful | `toast.success` | "Download avviato: {torrent title}" |
| Add-to-library failed | `toast.error` | "Errore nell'aggiunta: {error}" |
| Release search failed | `toast.error` | "Errore nella ricerca torrent: {error}" |
| Grab failed | `toast.error` | "Errore nel download: {error}" |

---

## Sorting

ReleaseTable supports client-side sorting by clicking column headers.

- Default: seeders descending (most seeders first).
- Sortable columns: seeders, leechers, size, age, quality name.
- Visual indicator: arrow icon on the active sort column.
- Sort direction toggles on repeated click of the same column.

---

## Data Flow Summary

```
SearchPage
├── search() → GET /lookup → results[]
├── expandedIndex state
└── SearchResultCard (for each result)
    ├── Card UI (poster, title, badges)
    ├── [Film expanded]
    │   ├── addToLibrary() → POST /movie (if needed)
    │   ├── fetchReleases() → GET /radarr/release?movieId=
    │   └── ReleaseTable
    │       └── grab() → POST /radarr/release
    └── [Series expanded]
        ├── addToLibrary() → POST /series (if needed)
        ├── fetchEpisodes() → GET /sonarr/episode?seriesId=
        └── EpisodeList
            ├── Season headers (collapsible)
            └── Episode rows
                ├── fetchReleases() → GET /sonarr/release?episodeId=
                └── ReleaseTable
                    └── grab() → POST /sonarr/release
```

---

## Constraints and Edge Cases

- **Single accordion:** Only one search result expanded at a time. Clicking a different card collapses the previous one.
- **Already in library:** If `item.id` exists in the lookup result, skip add-to-library step. Use the existing ID directly for release search.
- **Add-to-library requires profiles:** When auto-adding an item, fetch `qualityprofile` and `rootfolder` first (same as current `addItem` logic), using the first available profile and folder.
- **Empty releases:** If no releases are found, show "Nessun torrent trovato" message.
- **No episodes:** If a series has no episodes (future release), show "Nessun episodio disponibile".
- **Release search timeout:** Uses 30s timeout consistent with lookup endpoints.
- **Grab idempotency:** If user clicks download on a torrent already grabbed, Radarr/Sonarr handles it gracefully (re-grabs or ignores).
- **All UI text in Italian** consistent with the rest of the application.
