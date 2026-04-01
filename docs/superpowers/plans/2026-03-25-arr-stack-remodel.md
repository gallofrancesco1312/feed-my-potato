# ARR Stack Remodel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remodel FeedMyPlex from a Jackett-based torrent search interface into a unified ARR stack dashboard (Radarr, Sonarr, Prowlarr) using the API Gateway Puro pattern.

**Architecture:** Next.js API routes act as thin proxies to ARR service REST APIs via a shared `arrFetch`/`arrProxy` layer. No business logic in the backend — just auth injection, request forwarding, and error normalization. qBittorrent integration retained as-is for download management.

**Tech Stack:** Next.js 16.2.1 (App Router), React 19, TypeScript, Tailwind CSS v4, Jest + React Testing Library, Docker Compose with LinuxServer.io images.

**Design Spec:** `docs/superpowers/specs/2026-03-25-arr-stack-remodel-design.md`

> **Note:** Next.js 16.2.1 uses async `params` in route handlers (`{ params }: { params: Promise<{ id: string }> }`). Verify patterns against `node_modules/next/dist/docs/` before writing code (per AGENTS.md).

---

## File Structure

### Create

```
lib/
  arr-client.ts              — arrFetch, ArrConfigError, arrTestConnection (pure, testable)
  arr-proxy.ts               — arrProxy NextResponse wrapper for route handlers

app/api/radarr/
  movie/route.ts             — GET, POST
  movie/[id]/route.ts        — GET, PUT, DELETE
  lookup/route.ts            — GET ?term=
  command/route.ts           — POST
  queue/route.ts             — GET
  history/route.ts           — GET ?page&sortKey&sortDirection
  calendar/route.ts          — GET ?start&end
  qualityprofile/route.ts    — GET
  rootfolder/route.ts        — GET
  diskspace/route.ts         — GET
  health/route.ts            — GET

app/api/sonarr/
  series/route.ts            — GET, POST
  series/[id]/route.ts       — GET, PUT, DELETE
  episode/route.ts           — GET ?seriesId=
  lookup/route.ts            — GET ?term=
  command/route.ts           — POST
  queue/route.ts             — GET
  history/route.ts           — GET
  calendar/route.ts          — GET ?start&end
  qualityprofile/route.ts    — GET
  rootfolder/route.ts        — GET
  health/route.ts            — GET

app/api/prowlarr/
  indexer/route.ts           — GET, POST, PUT, DELETE
  indexer/[id]/test/route.ts — POST
  indexerstatus/route.ts     — GET
  applicationsync/route.ts   — POST
  health/route.ts            — GET

app/api/qbit/
  torrents/route.ts          — GET, PATCH
  torrents/[hash]/route.ts   — DELETE

app/api/system/
  health/route.ts            — GET (aggregated health)

app/api/test/
  [service]/route.ts         — GET (dynamic, replaces per-service dirs)

app/movies/page.tsx
app/series/page.tsx
app/calendar/page.tsx
app/history/page.tsx
app/indexers/page.tsx
app/system/page.tsx

__tests__/api/arr-client.test.ts
__tests__/components/DashboardPage.test.tsx
__tests__/components/MoviesPage.test.tsx
__tests__/components/SeriesPage.test.tsx
__tests__/components/DownloadsPage.test.tsx
__tests__/components/CalendarPage.test.tsx
__tests__/components/HistoryPage.test.tsx
__tests__/components/IndexersPage.test.tsx
__tests__/components/SystemPage.test.tsx
```

### Modify

```
lib/config.ts                           — new AppConfig shape (ARR services)
app/page.tsx                            — redirect → Dashboard
app/api/config/route.ts                 — new validation shape
app/api/stream/route.ts                 — remove cleanup/monitor logic
app/search/page.tsx                     — rewrite for Radarr/Sonarr lookup
app/downloads/page.tsx                  — rewrite with queue cross-referencing
components/Sidebar.tsx                  — 4 → 9 navigation links
components/TorrentRow.tsx               — add optional label prop
docker-compose.yml                      — add Radarr, Sonarr, Prowlarr; remove Jackett
__tests__/api/config.test.ts            — update for new config shape
__tests__/components/Sidebar.test.tsx    — update for 9 links
__tests__/components/SearchPage.test.tsx — update for new search behavior
```

### Delete

```
lib/jackett.ts
lib/cleanup.ts
lib/torrent-monitor.ts
lib/library.ts
app/api/search/route.ts
app/api/library/                        (entire directory)
app/api/test/jackett/                   (entire directory)
app/api/test/qbittorrent/               (entire directory)
app/api/torrents/route.ts               (replaced by /api/qbit/torrents)
app/api/torrents/[hash]/route.ts        (replaced by /api/qbit/torrents/[hash])
app/library/page.tsx
app/settings/page.tsx
components/SearchResults.tsx
components/LibraryTable.tsx
__tests__/api/jackett.test.ts
__tests__/api/cleanup.test.ts
__tests__/api/torrent-monitor.test.ts
__tests__/api/library.test.ts
__tests__/components/LibraryTable.test.tsx
__tests__/components/SearchResults.test.tsx
```

---

## Phase 1: Foundation

### Task 1: Config Rewrite

**Files:**
- Modify: `lib/config.ts`
- Modify: `app/api/config/route.ts`
- Modify: `__tests__/api/config.test.ts`

- [ ] **Step 1: Write failing tests for new config shape**

Replace the entire file:

```typescript
// __tests__/api/config.test.ts
import { readConfig, writeConfig, defaultConfig } from '@/lib/config'
import fs from 'fs'
import path from 'path'
import os from 'os'

const tmpFile = path.join(os.tmpdir(), `config-test-${Date.now()}.json`)

afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
})

test('readConfig returns defaultConfig when file missing', async () => {
  const result = await readConfig(tmpFile)
  expect(result).toEqual(defaultConfig)
})

test('defaultConfig has correct service URLs', () => {
  expect(defaultConfig.radarr.url).toBe('http://localhost:7878')
  expect(defaultConfig.sonarr.url).toBe('http://localhost:8989')
  expect(defaultConfig.prowlarr.url).toBe('http://localhost:9696')
  expect(defaultConfig.qbittorrent.url).toBe('http://localhost:8080')
})

test('writeConfig writes then readConfig reads back', async () => {
  const cfg = {
    ...defaultConfig,
    radarr: { url: 'http://radarr:7878', apiKey: 'abc123' },
  }
  await writeConfig(cfg, tmpFile)
  const result = await readConfig(tmpFile)
  expect(result.radarr.url).toBe('http://radarr:7878')
  expect(result.radarr.apiKey).toBe('abc123')
})

test('readConfig deep merges nested objects with defaults', async () => {
  const partial = JSON.stringify({ radarr: { url: 'http://remote:7878' } })
  await fs.promises.writeFile(tmpFile, partial)
  const result = await readConfig(tmpFile)
  expect(result.radarr.url).toBe('http://remote:7878')
  expect(result.radarr.apiKey).toBe(defaultConfig.radarr.apiKey)
})

test('readConfig preserves all service sections', async () => {
  const partial = JSON.stringify({ sonarr: { apiKey: 'test-key' } })
  await fs.promises.writeFile(tmpFile, partial)
  const result = await readConfig(tmpFile)
  expect(result.sonarr.apiKey).toBe('test-key')
  expect(result.sonarr.url).toBe(defaultConfig.sonarr.url)
  expect(result.radarr).toEqual(defaultConfig.radarr)
  expect(result.prowlarr).toEqual(defaultConfig.prowlarr)
  expect(result.qbittorrent).toEqual(defaultConfig.qbittorrent)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/config.test.ts --no-coverage`

Expected: FAIL — `defaultConfig.radarr` is undefined (old shape has `jackett`)

- [ ] **Step 3: Implement new config**

Replace the entire file:

```typescript
// lib/config.ts
import fs from 'fs/promises'

export interface ServiceConfig {
  url: string
  apiKey: string
}

export interface QBittorrentConfig {
  url: string
  username: string
  password: string
}

export interface AppConfig {
  radarr: ServiceConfig
  sonarr: ServiceConfig
  prowlarr: ServiceConfig
  qbittorrent: QBittorrentConfig
}

export const defaultConfig: AppConfig = {
  radarr: { url: 'http://localhost:7878', apiKey: '' },
  sonarr: { url: 'http://localhost:8989', apiKey: '' },
  prowlarr: { url: 'http://localhost:9696', apiKey: '' },
  qbittorrent: { url: 'http://localhost:8080', username: 'admin', password: '' },
}

const CONFIG_PATH = process.env.CONFIG_PATH ?? './config.json'

export async function readConfig(filePath = CONFIG_PATH): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      ...defaultConfig,
      ...parsed,
      radarr: { ...defaultConfig.radarr, ...(parsed.radarr ?? {}) },
      sonarr: { ...defaultConfig.sonarr, ...(parsed.sonarr ?? {}) },
      prowlarr: { ...defaultConfig.prowlarr, ...(parsed.prowlarr ?? {}) },
      qbittorrent: { ...defaultConfig.qbittorrent, ...(parsed.qbittorrent ?? {}) },
    }
  } catch {
    return { ...defaultConfig }
  }
}

export async function writeConfig(config: AppConfig, filePath = CONFIG_PATH): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api/config.test.ts --no-coverage`

Expected: PASS (all 5 tests)

- [ ] **Step 5: Update config API route validation**

Replace the entire file:

```typescript
// app/api/config/route.ts
import { NextResponse } from 'next/server'
import { readConfig, writeConfig, AppConfig } from '@/lib/config'

export async function GET() {
  try {
    const config = await readConfig()
    return NextResponse.json(config)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('radarr' in body) ||
    !('sonarr' in body) ||
    !('prowlarr' in body) ||
    !('qbittorrent' in body)
  ) {
    return NextResponse.json({ error: 'Invalid config shape' }, { status: 400 })
  }

  try {
    await writeConfig(body as AppConfig)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/config.ts app/api/config/route.ts __tests__/api/config.test.ts
git commit -m "feat: rewrite config for ARR stack (radarr, sonarr, prowlarr)"
```

---

### Task 2: ARR Client & Proxy

**Files:**
- Create: `lib/arr-client.ts`
- Create: `lib/arr-proxy.ts`
- Create: `__tests__/api/arr-client.test.ts`

- [ ] **Step 1: Write failing tests for arrFetch**

```typescript
// __tests__/api/arr-client.test.ts
import { arrFetch, arrTestConnection, ArrConfigError } from '@/lib/arr-client'
import { readConfig } from '@/lib/config'

jest.mock('@/lib/config')
global.fetch = jest.fn()

const mockReadConfig = readConfig as jest.MockedFunction<typeof readConfig>

afterEach(() => jest.resetAllMocks())

const baseConfig = {
  radarr: { url: 'http://radarr:7878', apiKey: 'radarr-key' },
  sonarr: { url: 'http://sonarr:8989', apiKey: 'sonarr-key' },
  prowlarr: { url: 'http://prowlarr:9696', apiKey: 'prowlarr-key' },
  qbittorrent: { url: 'http://qbit:8080', username: 'admin', password: 'pass' },
}

test('arrFetch calls Radarr with correct URL and X-Api-Key header', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 200,
    text: async () => JSON.stringify([{ id: 1, title: 'Inception' }]),
  })

  const result = await arrFetch('radarr', '/movie')

  expect(fetch).toHaveBeenCalledWith(
    'http://radarr:7878/api/v3/movie',
    expect.objectContaining({
      headers: expect.objectContaining({ 'X-Api-Key': 'radarr-key' }),
    }),
  )
  expect(result.data).toEqual([{ id: 1, title: 'Inception' }])
  expect(result.status).toBe(200)
})

test('arrFetch uses v1 API for Prowlarr', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 200,
    text: async () => JSON.stringify([]),
  })

  await arrFetch('prowlarr', '/indexer')

  expect(fetch).toHaveBeenCalledWith(
    'http://prowlarr:9696/api/v1/indexer',
    expect.anything(),
  )
})

test('arrFetch uses v3 API for Sonarr', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 200,
    text: async () => JSON.stringify([]),
  })

  await arrFetch('sonarr', '/series')

  expect(fetch).toHaveBeenCalledWith(
    'http://sonarr:8989/api/v3/series',
    expect.anything(),
  )
})

test('arrFetch throws ArrConfigError when apiKey missing', async () => {
  mockReadConfig.mockResolvedValue({
    ...baseConfig,
    radarr: { url: 'http://radarr:7878', apiKey: '' },
  })

  await expect(arrFetch('radarr', '/movie')).rejects.toThrow(ArrConfigError)
})

test('arrFetch throws ArrConfigError when url missing', async () => {
  mockReadConfig.mockResolvedValue({
    ...baseConfig,
    sonarr: { url: '', apiKey: 'key' },
  })

  await expect(arrFetch('sonarr', '/series')).rejects.toThrow(ArrConfigError)
})

test('arrFetch handles empty response body (204)', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 204,
    text: async () => '',
  })

  const result = await arrFetch('radarr', '/movie/1')
  expect(result.data).toBeNull()
  expect(result.status).toBe(204)
})

test('arrFetch forwards POST body and headers', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 201,
    text: async () => JSON.stringify({ id: 42 }),
  })

  const body = JSON.stringify({ tmdbId: 27205, title: 'Inception' })
  await arrFetch('radarr', '/movie', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })

  expect(fetch).toHaveBeenCalledWith(
    'http://radarr:7878/api/v3/movie',
    expect.objectContaining({
      method: 'POST',
      body,
      headers: expect.objectContaining({
        'X-Api-Key': 'radarr-key',
        'Content-Type': 'application/json',
      }),
    }),
  )
})

test('arrTestConnection returns true on 200', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 200,
    text: async () => JSON.stringify([]),
  })

  expect(await arrTestConnection('radarr')).toBe(true)
})

test('arrTestConnection returns false on network error', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'))

  expect(await arrTestConnection('radarr')).toBe(false)
})

test('arrTestConnection returns false on non-200', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 401,
    text: async () => JSON.stringify({ error: 'Unauthorized' }),
  })

  expect(await arrTestConnection('sonarr')).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/arr-client.test.ts --no-coverage`

Expected: FAIL — Cannot find module `@/lib/arr-client`

- [ ] **Step 3: Implement arrFetch and arrTestConnection**

```typescript
// lib/arr-client.ts
import { readConfig } from './config'

export type ArrService = 'radarr' | 'sonarr' | 'prowlarr'

export class ArrConfigError extends Error {
  constructor(public service: string) {
    super(`Configurazione mancante per ${service}`)
    this.name = 'ArrConfigError'
  }
}

export async function arrFetch(
  service: ArrService,
  path: string,
  init?: RequestInit,
): Promise<{ data: unknown; status: number }> {
  const cfg = await readConfig()
  const svc = cfg[service]
  if (!svc.url || !svc.apiKey) throw new ArrConfigError(service)

  const apiVersion = service === 'prowlarr' ? 'v1' : 'v3'
  const timeout = path.includes('lookup') ? 30000 : 15000

  const res = await fetch(`${svc.url}/api/${apiVersion}${path}`, {
    ...init,
    headers: {
      'X-Api-Key': svc.apiKey,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(timeout),
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  return { data, status: res.status }
}

export async function arrTestConnection(service: ArrService): Promise<boolean> {
  try {
    const { status } = await arrFetch(service, '/health')
    return status === 200
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api/arr-client.test.ts --no-coverage`

Expected: PASS (all 10 tests)

- [ ] **Step 5: Create arrProxy helper**

```typescript
// lib/arr-proxy.ts
import { NextResponse } from 'next/server'
import { arrFetch, ArrConfigError, type ArrService } from './arr-client'

export async function arrProxy(
  service: ArrService,
  path: string,
  init?: RequestInit,
): Promise<NextResponse> {
  try {
    const { data, status } = await arrFetch(service, path, init)
    if (data === null) return new NextResponse(null, { status })
    return NextResponse.json(data, { status })
  } catch (err) {
    if (err instanceof ArrConfigError) {
      return NextResponse.json(
        { error: 'Configurazione mancante', service },
        { status: 502 },
      )
    }
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Timeout', service },
        { status: 504 },
      )
    }
    return NextResponse.json(
      { error: 'Servizio non raggiungibile', service, detail: String(err) },
      { status: 503 },
    )
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/arr-client.ts lib/arr-proxy.ts __tests__/api/arr-client.test.ts
git commit -m "feat: add ARR client and proxy layer"
```

---

### Task 3: Remove Old Code

**Files:**
- Delete: `lib/jackett.ts`, `lib/cleanup.ts`, `lib/torrent-monitor.ts`, `lib/library.ts`
- Delete: `app/api/search/route.ts`, `app/api/library/` (dir), `app/api/test/jackett/` (dir), `app/api/test/qbittorrent/` (dir)
- Delete: `app/api/torrents/route.ts`, `app/api/torrents/[hash]/route.ts`
- Delete: `app/library/page.tsx`, `app/settings/page.tsx`
- Delete: `components/SearchResults.tsx`, `components/LibraryTable.tsx`
- Delete: `__tests__/api/jackett.test.ts`, `__tests__/api/cleanup.test.ts`, `__tests__/api/torrent-monitor.test.ts`, `__tests__/api/library.test.ts`
- Delete: `__tests__/components/LibraryTable.test.tsx`, `__tests__/components/SearchResults.test.tsx`

- [ ] **Step 1: Delete old lib files**

```bash
rm lib/jackett.ts lib/cleanup.ts lib/torrent-monitor.ts lib/library.ts
```

- [ ] **Step 2: Delete old API routes**

```bash
rm app/api/search/route.ts
rm -r app/api/library
rm -r app/api/test/jackett
rm -r app/api/test/qbittorrent
rm app/api/torrents/route.ts
rm app/api/torrents/\[hash\]/route.ts
rmdir app/api/torrents/\[hash\] app/api/torrents
```

- [ ] **Step 3: Delete old pages and components**

```bash
rm app/library/page.tsx
rmdir app/library
rm app/settings/page.tsx
rmdir app/settings
rm components/SearchResults.tsx components/LibraryTable.tsx
```

- [ ] **Step 4: Delete old test files**

```bash
rm __tests__/api/jackett.test.ts __tests__/api/cleanup.test.ts __tests__/api/torrent-monitor.test.ts __tests__/api/library.test.ts
rm __tests__/components/LibraryTable.test.tsx __tests__/components/SearchResults.test.tsx
```

- [ ] **Step 5: Verify remaining tests pass**

Run: `npx jest --no-coverage`

Expected: PASS — only `config.test.ts`, `qbittorrent.test.ts`, `arr-client.test.ts`, `Sidebar.test.tsx`, `TorrentRow.test.tsx`, `SearchPage.test.tsx` remain. Some may fail due to import changes (Sidebar and SearchPage tests reference old config shape) — that's expected and will be fixed in later tasks.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove Jackett, cleanup, torrent-monitor, library code"
```

---

## Phase 2: API Gateway

### Task 4: Radarr API Routes

**Files:**
- Create: `app/api/radarr/movie/route.ts`
- Create: `app/api/radarr/movie/[id]/route.ts`
- Create: `app/api/radarr/lookup/route.ts`
- Create: `app/api/radarr/command/route.ts`
- Create: `app/api/radarr/queue/route.ts`
- Create: `app/api/radarr/history/route.ts`
- Create: `app/api/radarr/calendar/route.ts`
- Create: `app/api/radarr/qualityprofile/route.ts`
- Create: `app/api/radarr/rootfolder/route.ts`
- Create: `app/api/radarr/diskspace/route.ts`
- Create: `app/api/radarr/health/route.ts`

- [ ] **Step 1: Create simple GET-only routes**

```typescript
// app/api/radarr/qualityprofile/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('radarr', '/qualityprofile')
}
```

```typescript
// app/api/radarr/rootfolder/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('radarr', '/rootfolder')
}
```

```typescript
// app/api/radarr/diskspace/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('radarr', '/diskspace')
}
```

```typescript
// app/api/radarr/health/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('radarr', '/health')
}
```

```typescript
// app/api/radarr/queue/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('radarr', `/queue${search}`)
}
```

- [ ] **Step 2: Create GET-with-params routes**

```typescript
// app/api/radarr/lookup/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('radarr', `/movie/lookup${search}`)
}
```

```typescript
// app/api/radarr/calendar/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('radarr', `/calendar${search}`)
}
```

```typescript
// app/api/radarr/history/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('radarr', `/history${search}`)
}
```

- [ ] **Step 3: Create CRUD routes**

```typescript
// app/api/radarr/movie/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('radarr', '/movie')
}

export async function POST(req: Request) {
  const body = await req.text()
  return arrProxy('radarr', '/movie', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

```typescript
// app/api/radarr/movie/[id]/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return arrProxy('radarr', `/movie/${id}`)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.text()
  return arrProxy('radarr', `/movie/${id}`, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return arrProxy('radarr', `/movie/${id}`, { method: 'DELETE' })
}
```

- [ ] **Step 4: Create command route**

```typescript
// app/api/radarr/command/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function POST(req: Request) {
  const body = await req.text()
  return arrProxy('radarr', '/command', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit`

Expected: No errors related to Radarr routes

- [ ] **Step 6: Commit**

```bash
git add app/api/radarr/
git commit -m "feat: add Radarr API proxy routes"
```

---

### Task 5: Sonarr API Routes

**Files:**
- Create: `app/api/sonarr/series/route.ts`
- Create: `app/api/sonarr/series/[id]/route.ts`
- Create: `app/api/sonarr/episode/route.ts`
- Create: `app/api/sonarr/lookup/route.ts`
- Create: `app/api/sonarr/command/route.ts`
- Create: `app/api/sonarr/queue/route.ts`
- Create: `app/api/sonarr/history/route.ts`
- Create: `app/api/sonarr/calendar/route.ts`
- Create: `app/api/sonarr/qualityprofile/route.ts`
- Create: `app/api/sonarr/rootfolder/route.ts`
- Create: `app/api/sonarr/health/route.ts`

- [ ] **Step 1: Create simple GET-only routes**

```typescript
// app/api/sonarr/qualityprofile/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('sonarr', '/qualityprofile')
}
```

```typescript
// app/api/sonarr/rootfolder/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('sonarr', '/rootfolder')
}
```

```typescript
// app/api/sonarr/health/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('sonarr', '/health')
}
```

```typescript
// app/api/sonarr/queue/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('sonarr', `/queue${search}`)
}
```

- [ ] **Step 2: Create GET-with-params routes**

```typescript
// app/api/sonarr/lookup/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('sonarr', `/series/lookup${search}`)
}
```

```typescript
// app/api/sonarr/calendar/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('sonarr', `/calendar${search}`)
}
```

```typescript
// app/api/sonarr/history/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('sonarr', `/history${search}`)
}
```

```typescript
// app/api/sonarr/episode/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('sonarr', `/episode${search}`)
}
```

- [ ] **Step 3: Create CRUD routes**

```typescript
// app/api/sonarr/series/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('sonarr', '/series')
}

export async function POST(req: Request) {
  const body = await req.text()
  return arrProxy('sonarr', '/series', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

```typescript
// app/api/sonarr/series/[id]/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return arrProxy('sonarr', `/series/${id}`)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.text()
  return arrProxy('sonarr', `/series/${id}`, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return arrProxy('sonarr', `/series/${id}`, { method: 'DELETE' })
}
```

- [ ] **Step 4: Create command route**

```typescript
// app/api/sonarr/command/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function POST(req: Request) {
  const body = await req.text()
  return arrProxy('sonarr', '/command', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit`

Expected: No errors related to Sonarr routes

- [ ] **Step 6: Commit**

```bash
git add app/api/sonarr/
git commit -m "feat: add Sonarr API proxy routes"
```

---

### Task 6: Prowlarr API Routes

**Files:**
- Create: `app/api/prowlarr/indexer/route.ts`
- Create: `app/api/prowlarr/indexer/[id]/test/route.ts`
- Create: `app/api/prowlarr/indexerstatus/route.ts`
- Create: `app/api/prowlarr/applicationsync/route.ts`
- Create: `app/api/prowlarr/health/route.ts`

- [ ] **Step 1: Create indexer CRUD route**

```typescript
// app/api/prowlarr/indexer/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('prowlarr', '/indexer')
}

export async function POST(req: Request) {
  const body = await req.text()
  return arrProxy('prowlarr', '/indexer', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function PUT(req: Request) {
  const body = await req.text()
  return arrProxy('prowlarr', '/indexer', {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function DELETE(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('prowlarr', `/indexer${search}`, { method: 'DELETE' })
}
```

- [ ] **Step 2: Create indexer test and remaining routes**

```typescript
// app/api/prowlarr/indexer/[id]/test/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return arrProxy('prowlarr', `/indexer/${id}/test`, { method: 'POST' })
}
```

```typescript
// app/api/prowlarr/indexerstatus/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('prowlarr', '/indexerstatus')
}
```

```typescript
// app/api/prowlarr/applicationsync/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function POST() {
  return arrProxy('prowlarr', '/command', {
    method: 'POST',
    body: JSON.stringify({ name: 'AppIndexerSync' }),
    headers: { 'Content-Type': 'application/json' },
  })
}
```

```typescript
// app/api/prowlarr/health/route.ts
import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('prowlarr', '/health')
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/prowlarr/
git commit -m "feat: add Prowlarr API proxy routes"
```

---

### Task 7: qBittorrent API Routes

**Files:**
- Create: `app/api/qbit/torrents/route.ts`
- Create: `app/api/qbit/torrents/[hash]/route.ts`

- [ ] **Step 1: Create qBit torrents route**

```typescript
// app/api/qbit/torrents/route.ts
import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'
import { QBittorrentClient } from '@/lib/qbittorrent'

async function makeClient() {
  const cfg = await readConfig()
  return new QBittorrentClient(
    cfg.qbittorrent.url,
    cfg.qbittorrent.username,
    cfg.qbittorrent.password,
  )
}

export async function GET() {
  try {
    const client = await makeClient()
    const torrents = await client.getTorrents()
    return NextResponse.json(torrents)
  } catch (err) {
    return NextResponse.json(
      { error: 'Servizio non raggiungibile', service: 'qbittorrent', detail: String(err) },
      { status: 503 },
    )
  }
}

export async function PATCH(req: Request) {
  const { hash, action } = await req.json()
  if (!hash || !action) {
    return NextResponse.json({ error: 'Missing hash or action' }, { status: 400 })
  }
  if (action !== 'pause' && action !== 'resume') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  try {
    const client = await makeClient()
    if (action === 'pause') await client.pauseTorrent(hash)
    else await client.resumeTorrent(hash)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Servizio non raggiungibile', service: 'qbittorrent', detail: String(err) },
      { status: 503 },
    )
  }
}
```

- [ ] **Step 2: Create qBit torrent delete route**

```typescript
// app/api/qbit/torrents/[hash]/route.ts
import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'
import { QBittorrentClient } from '@/lib/qbittorrent'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params
    const { deleteFiles } = await req.json().catch(() => ({ deleteFiles: false }))
    const cfg = await readConfig()
    const client = new QBittorrentClient(
      cfg.qbittorrent.url,
      cfg.qbittorrent.username,
      cfg.qbittorrent.password,
    )
    await client.deleteTorrent(hash, !!deleteFiles)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Servizio non raggiungibile', service: 'qbittorrent', detail: String(err) },
      { status: 503 },
    )
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/qbit/
git commit -m "feat: add qBittorrent API routes under /api/qbit"
```

---

### Task 8: System API Routes

**Files:**
- Create: `app/api/system/health/route.ts`
- Create: `app/api/test/[service]/route.ts`

- [ ] **Step 1: Create aggregated health check**

```typescript
// app/api/system/health/route.ts
import { NextResponse } from 'next/server'
import { arrTestConnection } from '@/lib/arr-client'
import { readConfig } from '@/lib/config'
import { QBittorrentClient } from '@/lib/qbittorrent'

export async function GET() {
  const cfg = await readConfig()

  const [radarr, sonarr, prowlarr, qbittorrent] = await Promise.all([
    arrTestConnection('radarr'),
    arrTestConnection('sonarr'),
    arrTestConnection('prowlarr'),
    new QBittorrentClient(
      cfg.qbittorrent.url,
      cfg.qbittorrent.username,
      cfg.qbittorrent.password,
    ).testConnection(),
  ])

  return NextResponse.json({ radarr, sonarr, prowlarr, qbittorrent })
}
```

- [ ] **Step 2: Create dynamic service test route**

```typescript
// app/api/test/[service]/route.ts
import { NextResponse } from 'next/server'
import { arrTestConnection, type ArrService } from '@/lib/arr-client'
import { readConfig } from '@/lib/config'
import { QBittorrentClient } from '@/lib/qbittorrent'

const ARR_SERVICES: ArrService[] = ['radarr', 'sonarr', 'prowlarr']

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const { service } = await params

  if (ARR_SERVICES.includes(service as ArrService)) {
    const ok = await arrTestConnection(service as ArrService)
    return NextResponse.json({ ok, service })
  }

  if (service === 'qbittorrent') {
    const cfg = await readConfig()
    const client = new QBittorrentClient(
      cfg.qbittorrent.url,
      cfg.qbittorrent.username,
      cfg.qbittorrent.password,
    )
    const ok = await client.testConnection()
    return NextResponse.json({ ok, service })
  }

  return NextResponse.json({ error: 'Servizio sconosciuto' }, { status: 400 })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/system/ app/api/test/
git commit -m "feat: add system health and service test routes"
```

---

### Task 9: SSE Stream Simplification

**Files:**
- Modify: `app/api/stream/route.ts`

- [ ] **Step 1: Rewrite stream route (remove cleanup/monitor logic)**

Replace the entire file:

```typescript
// app/api/stream/route.ts
import { readConfig } from '@/lib/config'
import { QBittorrentClient } from '@/lib/qbittorrent'

export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const cfg = await readConfig()
      const client = new QBittorrentClient(
        cfg.qbittorrent.url,
        cfg.qbittorrent.username,
        cfg.qbittorrent.password,
      )

      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      while (true) {
        try {
          const torrents = await client.getTorrents()
          send(torrents)
        } catch {
          send({ error: 'qBittorrent non raggiungibile' })
        }
        await new Promise(r => setTimeout(r, 2000))
      }
    },
    cancel() {},
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/stream/route.ts
git commit -m "refactor: simplify SSE stream (remove cleanup/monitor logic)"
```

---

## Phase 3: UI

### Task 10: Sidebar Update

**Files:**
- Modify: `components/Sidebar.tsx`
- Modify: `__tests__/components/Sidebar.test.tsx`

- [ ] **Step 1: Write failing test for 9 navigation links**

Replace the entire file:

```typescript
// __tests__/components/Sidebar.test.tsx
import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/Sidebar'

jest.mock('next/navigation', () => ({ usePathname: () => '/' }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    className,
    children,
  }: {
    href: string
    className: string
    children: React.ReactNode
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

test('renders all 9 navigation links', () => {
  render(<Sidebar />)
  expect(screen.getByText('Dashboard')).toBeInTheDocument()
  expect(screen.getByText('Cerca')).toBeInTheDocument()
  expect(screen.getByText('Film')).toBeInTheDocument()
  expect(screen.getByText('Serie TV')).toBeInTheDocument()
  expect(screen.getByText('Download')).toBeInTheDocument()
  expect(screen.getByText('Calendario')).toBeInTheDocument()
  expect(screen.getByText('Cronologia')).toBeInTheDocument()
  expect(screen.getByText('Indexer')).toBeInTheDocument()
  expect(screen.getByText('Sistema')).toBeInTheDocument()
})

test('highlights active link for Dashboard', () => {
  render(<Sidebar />)
  const dashboardLink = screen.getByText('Dashboard').closest('a')
  expect(dashboardLink?.className).toContain('text-purple-300')
})

test('non-active links have default styling', () => {
  render(<Sidebar />)
  const searchLink = screen.getByText('Cerca').closest('a')
  expect(searchLink?.className).toContain('text-gray-400')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/Sidebar.test.tsx --no-coverage`

Expected: FAIL — `Dashboard` text not found (old Sidebar has 4 links)

- [ ] **Step 3: Implement updated Sidebar**

Replace the entire file:

```typescript
// components/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  Film,
  Tv,
  Download,
  Calendar,
  Clock,
  Globe,
  Settings,
} from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/search', label: 'Cerca', icon: Search },
  { href: '/movies', label: 'Film', icon: Film },
  { href: '/series', label: 'Serie TV', icon: Tv },
  { href: '/downloads', label: 'Download', icon: Download },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/history', label: 'Cronologia', icon: Clock },
  { href: '/indexers', label: 'Indexer', icon: Globe },
  { href: '/system', label: 'Sistema', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 flex-shrink-0 h-screen bg-gray-900 flex flex-col p-4 gap-2 border-r border-gray-800">
      <div className="text-purple-400 font-bold text-lg mb-6">FeedMyPlex</div>
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              active
                ? 'bg-purple-700/30 text-purple-300'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        )
      })}
    </aside>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/Sidebar.test.tsx --no-coverage`

Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/Sidebar.tsx __tests__/components/Sidebar.test.tsx
git commit -m "feat: update Sidebar with 9 navigation links"
```

---

### Task 11: Dashboard Page

**Files:**
- Modify: `app/page.tsx`
- Create: `__tests__/components/DashboardPage.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/components/DashboardPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import DashboardPage from '@/app/page'

global.fetch = jest.fn()

beforeEach(() => {
  ;(global as any).EventSource = jest.fn(() => ({
    onmessage: null,
    onerror: null,
    close: jest.fn(),
  }))
  ;(fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/system/health')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ radarr: true, sonarr: true, prowlarr: true, qbittorrent: true }),
      })
    }
    if (url.includes('/api/radarr/movie')) {
      return Promise.resolve({ ok: true, json: async () => [{ id: 1 }, { id: 2 }] })
    }
    if (url.includes('/api/sonarr/series')) {
      return Promise.resolve({ ok: true, json: async () => [{ id: 1 }] })
    }
    return Promise.resolve({ ok: true, json: async () => [] })
  })
})

afterEach(() => jest.resetAllMocks())

test('renders dashboard heading', async () => {
  render(<DashboardPage />)
  await waitFor(() => {
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})

test('renders stat cards', async () => {
  render(<DashboardPage />)
  await waitFor(() => {
    expect(screen.getByText('Film')).toBeInTheDocument()
    expect(screen.getByText('Serie TV')).toBeInTheDocument()
    expect(screen.getByText('Download')).toBeInTheDocument()
    expect(screen.getByText('Servizi')).toBeInTheDocument()
  })
})

test('shows health status badges', async () => {
  render(<DashboardPage />)
  await waitFor(() => {
    expect(screen.getByText('Stato Servizi')).toBeInTheDocument()
    expect(screen.getByText('radarr')).toBeInTheDocument()
    expect(screen.getByText('sonarr')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/DashboardPage.test.tsx --no-coverage`

Expected: FAIL — current `app/page.tsx` just calls `redirect('/search')`

- [ ] **Step 3: Implement Dashboard page**

Replace the entire file:

```typescript
// app/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { Film, Tv, Download, HardDrive } from 'lucide-react'

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

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [movieCount, setMovieCount] = useState(0)
  const [seriesCount, setSeriesCount] = useState(0)
  const [calendar, setCalendar] = useState<CalendarItem[]>([])
  const [downloads, setDownloads] = useState<DownloadItem[]>([])

  useEffect(() => {
    fetch('/api/system/health').then(r => r.json()).then(setHealth).catch(() => {})
    fetch('/api/radarr/movie')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMovieCount(d.length) })
      .catch(() => {})
    fetch('/api/sonarr/series')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSeriesCount(d.length) })
      .catch(() => {})

    const now = new Date()
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const params = `?start=${now.toISOString()}&end=${end.toISOString()}`
    Promise.all([
      fetch(`/api/radarr/calendar${params}`).then(r => r.json()).catch(() => []),
      fetch(`/api/sonarr/calendar${params}`).then(r => r.json()).catch(() => []),
    ]).then(([movies, series]) => {
      const all = [
        ...(Array.isArray(movies) ? movies : []),
        ...(Array.isArray(series) ? series : []),
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Film} label="Film" value={movieCount} />
        <StatCard icon={Tv} label="Serie TV" value={seriesCount} />
        <StatCard icon={Download} label="Download" value={downloads.length} />
        <StatCard
          icon={HardDrive}
          label="Servizi"
          value={health ? Object.values(health).filter(Boolean).length : 0}
          suffix="/4"
        />
      </div>

      {health && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">Stato Servizi</h2>
          <div className="flex gap-3">
            {Object.entries(health).map(([name, ok]) => (
              <span
                key={name}
                className={`text-sm px-2 py-1 rounded ${
                  ok ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                }`}
              >
                {name}
              </span>
            ))}
          </div>
        </section>
      )}

      {downloads.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">Download Attivi</h2>
          <div className="space-y-2">
            {downloads.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm truncate flex-1">{d.name}</span>
                <div className="w-32 bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${Math.round(d.progress * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-10 text-right">
                  {Math.round(d.progress * 100)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {calendar.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">Prossime Uscite</h2>
          <div className="space-y-1">
            {calendar.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={item.hasFile ? 'text-green-400' : 'text-gray-400'}>
                  {item.hasFile ? '\u25CF' : '\u25CB'}
                </span>
                <span>{item.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/DashboardPage.test.tsx --no-coverage`

Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx __tests__/components/DashboardPage.test.tsx
git commit -m "feat: add Dashboard page with stats, health, downloads, calendar"
```

---

### Task 12: Search Page

**Files:**
- Modify: `app/search/page.tsx`
- Modify: `__tests__/components/SearchPage.test.tsx`

- [ ] **Step 1: Write failing test**

Replace the entire file:

```typescript
// __tests__/components/SearchPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchPage from '@/app/search/page'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

test('renders search input and mode buttons', () => {
  render(<SearchPage />)
  expect(screen.getByText('Cerca')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Cerca film o serie...')).toBeInTheDocument()
  expect(screen.getByText('Tutti')).toBeInTheDocument()
  expect(screen.getByText('Film')).toBeInTheDocument()
  expect(screen.getByText('Serie TV')).toBeInTheDocument()
})

test('searches and displays movie results', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      { title: 'Inception', year: 2010, tmdbId: 27205, overview: 'Un ladro...' },
    ],
  })

  const user = userEvent.setup()
  render(<SearchPage />)

  await user.click(screen.getByText('Film'))
  await user.type(screen.getByPlaceholderText('Cerca film o serie...'), 'Inception')
  await user.keyboard('{Enter}')

  await waitFor(() => {
    expect(screen.getByText('Inception')).toBeInTheDocument()
    expect(screen.getByText('2010')).toBeInTheDocument()
  })
})

test('shows Film and Serie badges in Tutti mode', async () => {
  ;(fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/radarr/lookup')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ title: 'Film Result', year: 2020, tmdbId: 1 }],
      })
    }
    if (url.includes('/api/sonarr/lookup')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ title: 'Serie Result', year: 2021, tvdbId: 2 }],
      })
    }
    return Promise.resolve({ ok: true, json: async () => [] })
  })

  const user = userEvent.setup()
  render(<SearchPage />)

  await user.type(screen.getByPlaceholderText('Cerca film o serie...'), 'test')
  await user.keyboard('{Enter}')

  await waitFor(() => {
    expect(screen.getByText('Film Result')).toBeInTheDocument()
    expect(screen.getByText('Serie Result')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/SearchPage.test.tsx --no-coverage`

Expected: FAIL — old SearchPage imports from removed modules

- [ ] **Step 3: Implement Search page**

Replace the entire file:

```typescript
// app/search/page.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search as SearchIcon, Plus } from 'lucide-react'

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
  const [adding, setAdding] = useState<number | null>(null)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setResults([])
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

  const addItem = async (item: LookupResult) => {
    const itemId = item.tmdbId ?? item.tvdbId ?? 0
    setAdding(itemId)
    try {
      if (item.type === 'movie') {
        const [profiles, folders] = await Promise.all([
          fetch('/api/radarr/qualityprofile').then(r => r.json()),
          fetch('/api/radarr/rootfolder').then(r => r.json()),
        ])
        await fetch('/api/radarr/movie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tmdbId: item.tmdbId,
            title: item.title,
            qualityProfileId: profiles[0]?.id,
            rootFolderPath: folders[0]?.path,
            monitored: true,
            addOptions: { searchForMovie: true },
          }),
        })
      } else {
        const [profiles, folders] = await Promise.all([
          fetch('/api/sonarr/qualityprofile').then(r => r.json()),
          fetch('/api/sonarr/rootfolder').then(r => r.json()),
        ])
        await fetch('/api/sonarr/series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tvdbId: item.tvdbId,
            title: item.title,
            qualityProfileId: profiles[0]?.id,
            rootFolderPath: folders[0]?.path,
            monitored: true,
            addOptions: { searchForMissingEpisodes: true },
          }),
        })
      }
    } finally {
      setAdding(null)
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
        <Button onClick={search} disabled={loading}>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((item, i) => (
          <div
            key={i}
            className="bg-gray-900 rounded-lg border border-gray-800 p-4 flex gap-3"
          >
            {item.remotePoster && (
              <img
                src={item.remotePoster}
                alt={item.title}
                className="w-16 h-24 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate">{item.title}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    item.type === 'movie'
                      ? 'bg-blue-900/30 text-blue-400'
                      : 'bg-green-900/30 text-green-400'
                  }`}
                >
                  {item.type === 'movie' ? 'Film' : 'Serie'}
                </span>
              </div>
              {item.year && <p className="text-xs text-gray-500">{item.year}</p>}
              {item.overview && (
                <p className="text-xs text-gray-400 line-clamp-2 mt-1">{item.overview}</p>
              )}
              <Button
                size="sm"
                className="mt-2"
                onClick={() => addItem(item)}
                disabled={adding === (item.tmdbId ?? item.tvdbId) || !!item.id}
              >
                {item.id ? (
                  'In libreria'
                ) : (
                  <>
                    <Plus size={14} /> Aggiungi
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/SearchPage.test.tsx --no-coverage`

Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/search/page.tsx __tests__/components/SearchPage.test.tsx
git commit -m "feat: rewrite Search page for Radarr/Sonarr lookup"
```

---

### Task 13: Movies Page

**Files:**
- Create: `app/movies/page.tsx`
- Create: `__tests__/components/MoviesPage.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/components/MoviesPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import MoviesPage from '@/app/movies/page'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

test('renders movies heading', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      { id: 1, title: 'Inception', year: 2010, monitored: true, hasFile: true, images: [] },
    ],
  })

  render(<MoviesPage />)
  await waitFor(() => {
    expect(screen.getByText('Film')).toBeInTheDocument()
  })
})

test('displays movie cards with title and year', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      { id: 1, title: 'Inception', year: 2010, monitored: true, hasFile: true, images: [] },
      { id: 2, title: 'Interstellar', year: 2014, monitored: true, hasFile: false, images: [] },
    ],
  })

  render(<MoviesPage />)
  await waitFor(() => {
    expect(screen.getByText('Inception')).toBeInTheDocument()
    expect(screen.getByText('2010')).toBeInTheDocument()
    expect(screen.getByText('Interstellar')).toBeInTheDocument()
    expect(screen.getByText('2014')).toBeInTheDocument()
  })
})

test('shows status labels', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      { id: 1, title: 'Movie A', year: 2020, monitored: true, hasFile: true, images: [] },
      { id: 2, title: 'Movie B', year: 2021, monitored: true, hasFile: false, images: [] },
    ],
  })

  render(<MoviesPage />)
  await waitFor(() => {
    expect(screen.getByText('Scaricato')).toBeInTheDocument()
    expect(screen.getByText('Mancante')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/MoviesPage.test.tsx --no-coverage`

Expected: FAIL — Cannot find module `@/app/movies/page`

- [ ] **Step 3: Implement Movies page**

```typescript
// app/movies/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { Film } from 'lucide-react'

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
              className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden"
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/MoviesPage.test.tsx --no-coverage`

Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/movies/page.tsx __tests__/components/MoviesPage.test.tsx
git commit -m "feat: add Movies page (Radarr library)"
```

---

### Task 14: Series Page

**Files:**
- Create: `app/series/page.tsx`
- Create: `__tests__/components/SeriesPage.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/components/SeriesPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import SeriesPage from '@/app/series/page'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

test('renders series heading', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      {
        id: 1,
        title: 'Breaking Bad',
        year: 2008,
        monitored: true,
        statistics: { episodeFileCount: 62, episodeCount: 62, seasonCount: 5 },
        images: [],
      },
    ],
  })

  render(<SeriesPage />)
  await waitFor(() => {
    expect(screen.getByText('Serie TV')).toBeInTheDocument()
  })
})

test('displays series with episode counts', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      {
        id: 1,
        title: 'Breaking Bad',
        year: 2008,
        monitored: true,
        statistics: { episodeFileCount: 62, episodeCount: 62, seasonCount: 5 },
        images: [],
      },
    ],
  })

  render(<SeriesPage />)
  await waitFor(() => {
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    expect(screen.getByText(/5 stagioni/)).toBeInTheDocument()
    expect(screen.getByText(/62\/62 episodi/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/SeriesPage.test.tsx --no-coverage`

Expected: FAIL — Cannot find module `@/app/series/page`

- [ ] **Step 3: Implement Series page**

```typescript
// app/series/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { Tv, ChevronDown, ChevronRight } from 'lucide-react'

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
              <button
                onClick={() => toggleExpand(s.id)}
                className="w-full flex items-center gap-3 p-3 text-left"
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
                  </p>
                </div>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/SeriesPage.test.tsx --no-coverage`

Expected: PASS (all 2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/series/page.tsx __tests__/components/SeriesPage.test.tsx
git commit -m "feat: add Series page (Sonarr library with episode drill-down)"
```

---

### Task 15: Downloads Page

**Files:**
- Modify: `app/downloads/page.tsx`
- Modify: `components/TorrentRow.tsx`
- Create: `__tests__/components/DownloadsPage.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/components/DownloadsPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import DownloadsPage from '@/app/downloads/page'

global.fetch = jest.fn()

beforeEach(() => {
  ;(global as any).EventSource = jest.fn(() => ({
    onmessage: null,
    onerror: null,
    close: jest.fn(),
  }))
  ;(fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/radarr/queue')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ records: [{ downloadId: 'abc123', title: 'Movie' }] }),
      })
    }
    if (url.includes('/api/sonarr/queue')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ records: [] }),
      })
    }
    return Promise.resolve({ ok: true, json: async () => ({}) })
  })
})

afterEach(() => jest.resetAllMocks())

test('renders downloads heading', async () => {
  render(<DownloadsPage />)
  expect(screen.getByText('Download')).toBeInTheDocument()
})

test('shows no downloads message when empty', async () => {
  render(<DownloadsPage />)
  await waitFor(() => {
    expect(screen.getByText('Nessun download attivo.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/DownloadsPage.test.tsx --no-coverage`

Expected: FAIL — old DownloadsPage references removed config shape

- [ ] **Step 3: Add label prop to TorrentRow**

Replace the entire file:

```typescript
// components/TorrentRow.tsx
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Torrent } from '@/lib/qbittorrent'

function formatSpeed(bps: number) {
  return bps > 1e6 ? `${(bps / 1e6).toFixed(1)} MB/s` : `${(bps / 1e3).toFixed(0)} KB/s`
}

function formatEta(secs: number) {
  if (secs > 86400 || secs < 0) return '\u221E'
  if (secs > 3600) return `${Math.floor(secs / 3600)}h`
  if (secs > 60) return `${Math.floor(secs / 60)}m`
  return `${secs}s`
}

const STATE_LABELS: Record<string, string> = {
  downloading: 'Scaricando',
  uploading: 'Completo',
  stalledDL: 'In attesa',
  pausedDL: 'In pausa',
  error: 'Errore',
  checkingDL: 'Controllo',
}

export function TorrentRow({
  torrent,
  onDelete,
  onTogglePause,
  label,
}: {
  torrent: Torrent
  onDelete: (hash: string, deleteFiles: boolean) => void
  onTogglePause: (hash: string, paused: boolean) => void
  label?: 'Film' | 'Serie' | null
}) {
  const pct = Math.round(torrent.progress * 100)
  const stateLabel = STATE_LABELS[torrent.state] ?? torrent.state
  const isPaused = torrent.state === 'pausedDL'
  return (
    <tr className="border-b border-gray-800/50">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          {label && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                label === 'Film'
                  ? 'bg-blue-900/30 text-blue-400'
                  : 'bg-green-900/30 text-green-400'
              }`}
            >
              {label}
            </span>
          )}
          <p className="font-medium truncate max-w-xs">{torrent.name}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Progress value={pct} className="h-1.5 w-40" />
          <span className="text-xs text-gray-400">{pct}%</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {formatSpeed(torrent.dlspeed)} &middot; ETA {formatEta(torrent.eta)}
        </p>
      </td>
      <td className="py-3">
        <Badge variant={torrent.state === 'error' ? 'destructive' : 'secondary'}>
          {stateLabel}
        </Badge>
      </td>
      <td className="py-3 text-right space-x-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onTogglePause(torrent.hash, isPaused)}
        >
          {isPaused ? 'Riprendi' : 'Pausa'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDelete(torrent.hash, false)}>
          Rimuovi
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(torrent.hash, true)}>
          Elimina file
        </Button>
      </td>
    </tr>
  )
}
```

- [ ] **Step 4: Implement Downloads page**

Replace the entire file:

```typescript
// app/downloads/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { TorrentRow } from '@/components/TorrentRow'
import type { Torrent } from '@/lib/qbittorrent'

interface QueueRecord {
  downloadId: string
  title: string
}

export default function DownloadsPage() {
  const [torrents, setTorrents] = useState<Torrent[]>([])
  const [radarrQueue, setRadarrQueue] = useState<QueueRecord[]>([])
  const [sonarrQueue, setSonarrQueue] = useState<QueueRecord[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const es = new EventSource('/api/stream')
    es.onmessage = e => {
      const data = JSON.parse(e.data)
      if (Array.isArray(data)) {
        setTorrents(data)
        setError('')
      } else {
        setError('qBittorrent non raggiungibile')
      }
    }
    es.onerror = () => setError('Connessione SSE interrotta')

    fetch('/api/radarr/queue')
      .then(r => r.json())
      .then(d => {
        if (d?.records) setRadarrQueue(d.records)
      })
      .catch(() => {})
    fetch('/api/sonarr/queue')
      .then(r => r.json())
      .then(d => {
        if (d?.records) setSonarrQueue(d.records)
      })
      .catch(() => {})

    return () => es.close()
  }, [])

  const getLabel = (hash: string): 'Film' | 'Serie' | null => {
    const h = hash.toLowerCase()
    if (radarrQueue.some(q => q.downloadId?.toLowerCase() === h)) return 'Film'
    if (sonarrQueue.some(q => q.downloadId?.toLowerCase() === h)) return 'Serie'
    return null
  }

  const deleteTorrent = async (hash: string, deleteFiles: boolean) => {
    await fetch(`/api/qbit/torrents/${hash}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteFiles }),
    })
  }

  const togglePause = async (hash: string, isPaused: boolean) => {
    await fetch('/api/qbit/torrents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash, action: isPaused ? 'resume' : 'pause' }),
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Download</h1>
      {error && (
        <p className="text-red-400 text-sm mb-4">
          {error} &mdash;{' '}
          <a href="/system" className="underline">
            Controlla il sistema
          </a>
        </p>
      )}
      {torrents.length === 0 && !error && (
        <p className="text-gray-500">Nessun download attivo.</p>
      )}
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
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/components/DownloadsPage.test.tsx --no-coverage`

Expected: PASS (all 2 tests)

- [ ] **Step 6: Commit**

```bash
git add app/downloads/page.tsx components/TorrentRow.tsx __tests__/components/DownloadsPage.test.tsx
git commit -m "feat: rewrite Downloads page with Film/Serie labels from ARR queues"
```

---

### Task 16: Calendar Page

**Files:**
- Create: `app/calendar/page.tsx`
- Create: `__tests__/components/CalendarPage.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/components/CalendarPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import CalendarPage from '@/app/calendar/page'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

test('renders calendar heading', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] })

  render(<CalendarPage />)
  await waitFor(() => {
    expect(screen.getByText('Calendario')).toBeInTheDocument()
  })
})

test('displays calendar items sorted by date', async () => {
  ;(fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/radarr/calendar')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ title: 'New Movie', inCinemas: '2026-04-01', hasFile: false }],
      })
    }
    if (url.includes('/api/sonarr/calendar')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            title: 'Episode Title',
            seriesTitle: 'Test Series',
            seasonNumber: 2,
            episodeNumber: 5,
            airDateUtc: '2026-03-28',
            hasFile: false,
          },
        ],
      })
    }
    return Promise.resolve({ ok: true, json: async () => [] })
  })

  render(<CalendarPage />)
  await waitFor(() => {
    expect(screen.getByText('New Movie')).toBeInTheDocument()
    expect(screen.getByText(/Test Series S02E05/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/CalendarPage.test.tsx --no-coverage`

Expected: FAIL — Cannot find module `@/app/calendar/page`

- [ ] **Step 3: Implement Calendar page**

```typescript
// app/calendar/page.tsx
'use client'
import { useEffect, useState } from 'react'

interface CalendarItem {
  title: string
  seriesTitle?: string
  seasonNumber?: number
  episodeNumber?: number
  airDateUtc?: string
  inCinemas?: string
  hasFile: boolean
  type: 'movie' | 'episode'
}

export default function CalendarPage() {
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const params = `?start=${start.toISOString()}&end=${end.toISOString()}`

    Promise.all([
      fetch(`/api/radarr/calendar${params}`)
        .then(r => r.json())
        .catch(() => []),
      fetch(`/api/sonarr/calendar${params}`)
        .then(r => r.json())
        .catch(() => []),
    ])
      .then(([movies, episodes]) => {
        const all: CalendarItem[] = [
          ...(Array.isArray(movies)
            ? movies.map((m: CalendarItem) => ({ ...m, type: 'movie' as const }))
            : []),
          ...(Array.isArray(episodes)
            ? episodes.map((e: CalendarItem) => ({ ...e, type: 'episode' as const }))
            : []),
        ]
        all.sort((a, b) => {
          const dateA = a.airDateUtc ?? a.inCinemas ?? ''
          const dateB = b.airDateUtc ?? b.inCinemas ?? ''
          return dateA.localeCompare(dateB)
        })
        setItems(all)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-500">Caricamento...</p>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Calendario</h1>
      {items.length === 0 && <p className="text-gray-500">Nessuna uscita questo mese.</p>}
      <div className="space-y-2">
        {items.map((item, i) => {
          const date = item.airDateUtc ?? item.inCinemas ?? ''
          const formatted = date
            ? new Date(date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
            : ''
          return (
            <div
              key={i}
              className="flex items-center gap-3 bg-gray-900 rounded-lg border border-gray-800 p-3"
            >
              <span className="text-sm text-gray-400 w-16">{formatted}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  item.type === 'movie'
                    ? 'bg-blue-900/30 text-blue-400'
                    : 'bg-green-900/30 text-green-400'
                }`}
              >
                {item.type === 'movie' ? 'Film' : 'Serie'}
              </span>
              <span className="text-sm flex-1">
                {item.type === 'episode'
                  ? `${item.seriesTitle} S${String(item.seasonNumber).padStart(2, '0')}E${String(item.episodeNumber).padStart(2, '0')} \u2014 ${item.title}`
                  : item.title}
              </span>
              <span
                className={
                  item.hasFile ? 'text-green-400 text-xs' : 'text-gray-500 text-xs'
                }
              >
                {item.hasFile ? 'Scaricato' : 'Mancante'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/CalendarPage.test.tsx --no-coverage`

Expected: PASS (all 2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/calendar/page.tsx __tests__/components/CalendarPage.test.tsx
git commit -m "feat: add Calendar page (Radarr + Sonarr releases)"
```

---

### Task 17: History Page

**Files:**
- Create: `app/history/page.tsx`
- Create: `__tests__/components/HistoryPage.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/components/HistoryPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import HistoryPage from '@/app/history/page'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

test('renders history heading', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ records: [] }),
  })

  render(<HistoryPage />)
  await waitFor(() => {
    expect(screen.getByText('Cronologia')).toBeInTheDocument()
  })
})

test('displays history items', async () => {
  ;(fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/radarr/history')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          records: [
            {
              date: '2026-03-24T10:00:00Z',
              eventType: 'grabbed',
              sourceTitle: 'Inception.2010.1080p',
              quality: { quality: { name: '1080p' } },
            },
          ],
        }),
      })
    }
    return Promise.resolve({ ok: true, json: async () => ({ records: [] }) })
  })

  render(<HistoryPage />)
  await waitFor(() => {
    expect(screen.getByText('Inception.2010.1080p')).toBeInTheDocument()
    expect(screen.getByText('Scaricamento')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/HistoryPage.test.tsx --no-coverage`

Expected: FAIL — Cannot find module `@/app/history/page`

- [ ] **Step 3: Implement History page**

```typescript
// app/history/page.tsx
'use client'
import { useEffect, useState } from 'react'

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

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = '?pageSize=50&sortDirection=descending&sortKey=date'
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
        setItems(all.slice(0, 50))
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-500">Caricamento...</p>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cronologia</h1>
      {items.length === 0 && <p className="text-gray-500">Nessuna attività recente.</p>}
      <table className="w-full">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase">
            <th className="pb-2">Data</th>
            <th className="pb-2">Tipo</th>
            <th className="pb-2">Evento</th>
            <th className="pb-2">Titolo</th>
            <th className="pb-2">Qualità</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-t border-gray-800">
              <td className="py-2 text-sm text-gray-400">
                {new Date(item.date).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="py-2">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    item.type === 'movie'
                      ? 'bg-blue-900/30 text-blue-400'
                      : 'bg-green-900/30 text-green-400'
                  }`}
                >
                  {item.type === 'movie' ? 'Film' : 'Serie'}
                </span>
              </td>
              <td className="py-2 text-sm">
                {EVENT_LABELS[item.eventType] ?? item.eventType}
              </td>
              <td className="py-2 text-sm">{item.sourceTitle}</td>
              <td className="py-2 text-sm text-gray-400">
                {item.quality?.quality?.name ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/HistoryPage.test.tsx --no-coverage`

Expected: PASS (all 2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/history/page.tsx __tests__/components/HistoryPage.test.tsx
git commit -m "feat: add History page (aggregated Radarr + Sonarr activity)"
```

---

### Task 18: Indexers Page

**Files:**
- Create: `app/indexers/page.tsx`
- Create: `__tests__/components/IndexersPage.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/components/IndexersPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import IndexersPage from '@/app/indexers/page'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

test('renders indexers heading', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] })

  render(<IndexersPage />)
  await waitFor(() => {
    expect(screen.getByText('Indexer')).toBeInTheDocument()
  })
})

test('displays indexer list with test buttons', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      { id: 1, name: 'Test Indexer', protocol: 'torrent', enable: true, fields: [] },
      { id: 2, name: 'Another', protocol: 'usenet', enable: false, fields: [] },
    ],
  })

  render(<IndexersPage />)
  await waitFor(() => {
    expect(screen.getByText('Test Indexer')).toBeInTheDocument()
    expect(screen.getByText('Another')).toBeInTheDocument()
    expect(screen.getByText('torrent')).toBeInTheDocument()
    expect(screen.getByText('usenet')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/IndexersPage.test.tsx --no-coverage`

Expected: FAIL — Cannot find module `@/app/indexers/page`

- [ ] **Step 3: Implement Indexers page**

```typescript
// app/indexers/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface Indexer {
  id: number
  name: string
  protocol: string
  enable: boolean
  fields: { name: string; value: unknown }[]
}

export default function IndexersPage() {
  const [indexers, setIndexers] = useState<Indexer[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResults, setTestResults] = useState<Record<number, boolean>>({})

  useEffect(() => {
    fetch('/api/prowlarr/indexer')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setIndexers(data)
      })
      .finally(() => setLoading(false))
  }, [])

  const testIndexer = async (id: number) => {
    setTesting(id)
    try {
      const res = await fetch(`/api/prowlarr/indexer/${id}/test`, { method: 'POST' })
      setTestResults(prev => ({ ...prev, [id]: res.ok }))
    } catch {
      setTestResults(prev => ({ ...prev, [id]: false }))
    } finally {
      setTesting(null)
    }
  }

  const syncApps = async () => {
    await fetch('/api/prowlarr/applicationsync', { method: 'POST' })
  }

  if (loading) return <p className="text-gray-500">Caricamento...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Indexer</h1>
        <Button variant="outline" size="sm" onClick={syncApps}>
          Sync Applicazioni
        </Button>
      </div>
      {indexers.length === 0 && (
        <p className="text-gray-500">Nessun indexer configurato.</p>
      )}
      <div className="space-y-2">
        {indexers.map(ix => (
          <div
            key={ix.id}
            className="bg-gray-900 rounded-lg border border-gray-800 p-3 flex items-center gap-3"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                ix.enable ? 'bg-green-400' : 'bg-gray-600'
              }`}
            />
            <span className="flex-1 font-semibold text-sm">{ix.name}</span>
            <span className="text-xs text-gray-500">{ix.protocol}</span>
            {testResults[ix.id] !== undefined && (
              <span
                className={`text-xs ${
                  testResults[ix.id] ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {testResults[ix.id] ? 'OK' : 'Errore'}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => testIndexer(ix.id)}
              disabled={testing === ix.id}
            >
              {testing === ix.id ? '...' : 'Test'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/IndexersPage.test.tsx --no-coverage`

Expected: PASS (all 2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/indexers/page.tsx __tests__/components/IndexersPage.test.tsx
git commit -m "feat: add Indexers page (Prowlarr management)"
```

---

### Task 19: System Page

**Files:**
- Create: `app/system/page.tsx`
- Create: `__tests__/components/SystemPage.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/components/SystemPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import SystemPage from '@/app/system/page'

global.fetch = jest.fn()

beforeEach(() => {
  ;(fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/config')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          radarr: { url: 'http://radarr:7878', apiKey: 'key1' },
          sonarr: { url: 'http://sonarr:8989', apiKey: 'key2' },
          prowlarr: { url: 'http://prowlarr:9696', apiKey: 'key3' },
          qbittorrent: { url: 'http://qbit:8080', username: 'admin', password: 'pass' },
        }),
      })
    }
    if (url.includes('/api/system/health')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          radarr: true,
          sonarr: true,
          prowlarr: true,
          qbittorrent: true,
        }),
      })
    }
    return Promise.resolve({ ok: true, json: async () => ({}) })
  })
})

afterEach(() => jest.resetAllMocks())

test('renders system heading', async () => {
  render(<SystemPage />)
  await waitFor(() => {
    expect(screen.getByText('Sistema')).toBeInTheDocument()
  })
})

test('shows service config sections', async () => {
  render(<SystemPage />)
  await waitFor(() => {
    expect(screen.getByText('Radarr')).toBeInTheDocument()
    expect(screen.getByText('Sonarr')).toBeInTheDocument()
    expect(screen.getByText('Prowlarr')).toBeInTheDocument()
    expect(screen.getByText(/qBittorrent/i)).toBeInTheDocument()
  })
})

test('shows health status badges', async () => {
  render(<SystemPage />)
  await waitFor(() => {
    expect(screen.getByText('Stato Servizi')).toBeInTheDocument()
    expect(screen.getByText('radarr')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/SystemPage.test.tsx --no-coverage`

Expected: FAIL — Cannot find module `@/app/system/page`

- [ ] **Step 3: Implement System page**

```typescript
// app/system/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Config {
  radarr: { url: string; apiKey: string }
  sonarr: { url: string; apiKey: string }
  prowlarr: { url: string; apiKey: string }
  qbittorrent: { url: string; username: string; password: string }
}

interface HealthStatus {
  radarr: boolean
  sonarr: boolean
  prowlarr: boolean
  qbittorrent: boolean
}

export default function SystemPage() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [saved, setSaved] = useState(false)
  const [tests, setTests] = useState<Record<string, boolean | null>>({})

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setCfg)
    fetch('/api/system/health').then(r => r.json()).then(setHealth)
  }, [])

  const save = async () => {
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testService = async (service: string) => {
    setTests(t => ({ ...t, [service]: null }))
    const res = await fetch(`/api/test/${service}`)
    const { ok } = await res.json()
    setTests(t => ({ ...t, [service]: ok }))
  }

  if (!cfg) return <p className="text-gray-500">Caricamento...</p>

  const arrServices = ['radarr', 'sonarr', 'prowlarr'] as const
  const portMap = { radarr: '7878', sonarr: '8989', prowlarr: '9696' }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Sistema</h1>

      {health && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">
            Stato Servizi
          </h2>
          <div className="flex gap-3">
            {Object.entries(health).map(([name, ok]) => (
              <span
                key={name}
                className={`text-sm px-2 py-1 rounded ${
                  ok
                    ? 'bg-green-900/30 text-green-400'
                    : 'bg-red-900/30 text-red-400'
                }`}
              >
                {name}
              </span>
            ))}
          </div>
        </section>
      )}

      {arrServices.map(service => (
        <section key={service} className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase flex justify-between">
            {service.charAt(0).toUpperCase() + service.slice(1)}
            <button
              onClick={() => testService(service)}
              className="text-xs text-purple-400 hover:underline"
            >
              {tests[service] === null
                ? '...'
                : tests[service] === true
                  ? 'OK'
                  : tests[service] === false
                    ? 'Errore'
                    : 'Test connessione'}
            </button>
          </h2>
          <Input
            value={cfg[service].url}
            onChange={e =>
              setCfg({ ...cfg, [service]: { ...cfg[service], url: e.target.value } })
            }
            placeholder={`http://localhost:${portMap[service]}`}
          />
          <Input
            value={cfg[service].apiKey}
            onChange={e =>
              setCfg({ ...cfg, [service]: { ...cfg[service], apiKey: e.target.value } })
            }
            placeholder="API Key"
          />
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase flex justify-between">
          qBittorrent
          <button
            onClick={() => testService('qbittorrent')}
            className="text-xs text-purple-400 hover:underline"
          >
            {tests.qbittorrent === null
              ? '...'
              : tests.qbittorrent === true
                ? 'OK'
                : tests.qbittorrent === false
                  ? 'Errore'
                  : 'Test connessione'}
          </button>
        </h2>
        <Input
          value={cfg.qbittorrent.url}
          onChange={e =>
            setCfg({
              ...cfg,
              qbittorrent: { ...cfg.qbittorrent, url: e.target.value },
            })
          }
          placeholder="http://localhost:8080"
        />
        <Input
          value={cfg.qbittorrent.username}
          onChange={e =>
            setCfg({
              ...cfg,
              qbittorrent: { ...cfg.qbittorrent, username: e.target.value },
            })
          }
          placeholder="admin"
        />
        <Input
          type="password"
          value={cfg.qbittorrent.password}
          onChange={e =>
            setCfg({
              ...cfg,
              qbittorrent: { ...cfg.qbittorrent, password: e.target.value },
            })
          }
          placeholder="Password"
        />
      </section>

      <Button onClick={save}>{saved ? 'Salvato' : 'Salva'}</Button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/SystemPage.test.tsx --no-coverage`

Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/system/page.tsx __tests__/components/SystemPage.test.tsx
git commit -m "feat: add System page (health status + service config)"
```

---

## Phase 4: Infrastructure

### Task 20: Docker Compose Update

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Update docker-compose.yml**

Replace the entire file:

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./config.json:/app/config.json
    depends_on:
      - radarr
      - sonarr
      - prowlarr
      - qbittorrent
    restart: unless-stopped

  radarr:
    image: lscr.io/linuxserver/radarr:latest
    ports:
      - "7878:7878"
    volumes:
      - ./radarr-config:/config
      - /mnt/e/PlexMedia:/media/plex
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Rome
    restart: unless-stopped

  sonarr:
    image: lscr.io/linuxserver/sonarr:latest
    ports:
      - "8989:8989"
    volumes:
      - ./sonarr-config:/config
      - /mnt/e/PlexMedia:/media/plex
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Rome
    restart: unless-stopped

  prowlarr:
    image: lscr.io/linuxserver/prowlarr:latest
    ports:
      - "9696:9696"
    volumes:
      - ./prowlarr-config:/config
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Rome
    restart: unless-stopped

  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    ports:
      - "8080:8080"
      - "16881:16881"
      - "16881:16881/udp"
    volumes:
      - ./qbittorrent-config:/config
      - /mnt/e/PlexMedia:/media/plex
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Rome
      - WEBUI_PORT=8080
    restart: unless-stopped

  flaresolverr:
    image: ghcr.io/flaresolverr/flaresolverr:latest
    ports:
      - "8191:8191"
    environment:
      - TZ=Europe/Rome
    restart: unless-stopped
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add Radarr, Sonarr, Prowlarr to docker-compose; remove Jackett"
```

---

### Task 21: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx jest --no-coverage`

Expected: ALL PASS. If any test fails, investigate and fix before proceeding.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Run lint**

Run: `npx eslint .`

Expected: No critical errors (warnings acceptable).

- [ ] **Step 4: Run build**

Run: `npx next build`

Expected: Build succeeds. All pages compile.

- [ ] **Step 5: Verify no leftover references to old modules**

Run: `grep -r "jackett\|plexFolder\|torrent-monitor\|lib/cleanup\|lib/library\|/api/search\|/api/torrents[^/]" --include="*.ts" --include="*.tsx" lib/ app/ components/ __tests__/ || echo "Clean"`

Expected: "Clean" — no references to removed modules.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final verification — all tests pass, build succeeds"
```
