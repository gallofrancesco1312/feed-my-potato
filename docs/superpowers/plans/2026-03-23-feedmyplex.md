# FeedMyPlex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted Next.js web app to search torrents via Jackett, download them with qBittorrent into a Plex folder, auto-clean non-video files, and manage files through a UI.

**Architecture:** Next.js 15 App Router monolite with API Routes for all backend logic. Real-time download status is pushed to clients via Server-Sent Events (SSE). Configuration is persisted in a local `config.json` file. No database, no separate process.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Jest, React Testing Library, Node.js `fs` (file ops), native `fetch` (HTTP).

---

## File Map

| File | Responsibility |
|------|---------------|
| `app/layout.tsx` | Root layout — renders Sidebar + `{children}` |
| `app/page.tsx` | Redirect to `/search` |
| `app/search/page.tsx` | Search UI (input + results table) |
| `app/downloads/page.tsx` | Active downloads list (SSE consumer) |
| `app/library/page.tsx` | Video file browser + delete |
| `app/settings/page.tsx` | Config form + connection test |
| `app/api/config/route.ts` | GET/PUT `config.json` |
| `app/api/search/route.ts` | Proxy search → Jackett |
| `app/api/torrents/route.ts` | GET all torrents / POST magnet link |
| `app/api/torrents/[hash]/route.ts` | DELETE torrent (optionally files) |
| `app/api/stream/route.ts` | SSE — polls qBit every 2s, triggers cleanup |
| `app/api/library/route.ts` | GET video files in Plex folder |
| `app/api/library/[filename]/route.ts` | DELETE single file from Plex folder |
| `app/api/test/jackett/route.ts` | GET — ping Jackett with saved config |
| `app/api/test/qbittorrent/route.ts` | GET — ping qBittorrent with saved config |
| `components/Sidebar.tsx` | Fixed left nav (4 links + logo) |
| `components/SearchResults.tsx` | Results table row + Download button |
| `components/TorrentRow.tsx` | Single active torrent with progress bar |
| `components/LibraryTable.tsx` | Video files table + Delete button |
| `components/StatusToast.tsx` | Success/error toast notifications |
| `lib/config.ts` | Read/write `config.json` from disk |
| `lib/library.ts` | List and delete video files from Plex folder |
| `lib/jackett.ts` | Jackett HTTP API client |
| `lib/qbittorrent.ts` | qBittorrent HTTP API client |
| `lib/cleanup.ts` | Post-download: move videos, delete rest |

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`
- Create: `.gitignore`
- Create: `jest.config.ts`, `jest.setup.ts`
- Create: `docker-compose.yml`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /home/frangallo/feed-my-plex
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --yes
```

- [ ] **Step 2: Install shadcn/ui**

```bash
npx shadcn@latest init --defaults
npx shadcn@latest add button input table toast badge progress
```

- [ ] **Step 3: Install testing dependencies**

```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest
```

- [ ] **Step 4: Create `jest.config.ts`**

```ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/api/**/*.test.ts'],
      transform: { '^.+\\.tsx?$': ['ts-jest', {}] },
    },
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['**/__tests__/components/**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      transform: { '^.+\\.tsx?$': ['ts-jest', {}] },
    },
  ],
}

export default createJestConfig(config)
```

- [ ] **Step 5: Create `jest.setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Create `.gitignore` additions**

Ensure `config.json` and `.superpowers/` are in `.gitignore`:

```
# FeedMyPlex
config.json
.superpowers/
```

- [ ] **Step 7: Create `docker-compose.yml`**

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./config.json:/app/config.json
      - ${PLEX_FOLDER:-/tmp/plex}:/media/plex

  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    ports:
      - "8080:8080"
      - "6881:6881"
    environment:
      - WEBUI_PORT=8080
    volumes:
      - ./downloads:/downloads

  jackett:
    image: lscr.io/linuxserver/jackett:latest
    ports:
      - "9117:9117"
    volumes:
      - ./jackett-config:/config
```

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "chore: bootstrap Next.js 15 project with testing setup"
```

---

## Task 2: Config System

**Files:**
- Create: `lib/config.ts`
- Create: `app/api/config/route.ts`
- Create: `__tests__/api/config.test.ts`

- [ ] **Step 1: Write failing tests for `lib/config.ts`**

Create `__tests__/api/config.test.ts`:

```ts
import { readConfig, writeConfig, defaultConfig } from '@/lib/config'
import fs from 'fs'
import path from 'path'
import os from 'os'

const tmpFile = path.join(os.tmpdir(), `config-test-${Date.now()}.json`)

afterEach(() => { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) })

test('readConfig returns defaultConfig when file missing', async () => {
  const result = await readConfig(tmpFile)
  expect(result).toEqual(defaultConfig)
})

test('writeConfig writes then readConfig reads back', async () => {
  const cfg = { ...defaultConfig, plexFolder: '/tmp/plex' }
  await writeConfig(cfg, tmpFile)
  const result = await readConfig(tmpFile)
  expect(result.plexFolder).toBe('/tmp/plex')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/config.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '@/lib/config'`

- [ ] **Step 3: Create `lib/config.ts`**

```ts
import fs from 'fs/promises'

export interface AppConfig {
  plexFolder: string
  jackett: { url: string; apiKey: string }
  qbittorrent: { url: string; username: string; password: string }
}

export const defaultConfig: AppConfig = {
  plexFolder: '',
  jackett: { url: 'http://localhost:9117', apiKey: '' },
  qbittorrent: { url: 'http://localhost:8080', username: 'admin', password: '' },
}

const CONFIG_PATH = process.env.CONFIG_PATH ?? './config.json'

export async function readConfig(filePath = CONFIG_PATH): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return { ...defaultConfig, ...JSON.parse(raw) }
  } catch {
    return defaultConfig
  }
}

export async function writeConfig(config: AppConfig, filePath = CONFIG_PATH): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/config.test.ts --no-coverage
```
Expected: PASS

- [ ] **Step 5: Create `app/api/config/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { readConfig, writeConfig } from '@/lib/config'

export async function GET() {
  const config = await readConfig()
  return NextResponse.json(config)
}

export async function PUT(req: Request) {
  const body = await req.json()
  await writeConfig(body)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/config.ts app/api/config/route.ts __tests__/api/config.test.ts
git commit -m "feat: config read/write system with API route"
```

---

## Task 3: Jackett Client + Search API

**Files:**
- Create: `lib/jackett.ts`
- Create: `app/api/search/route.ts`
- Create: `app/api/test/jackett/route.ts`
- Create: `__tests__/api/jackett.test.ts`

- [ ] **Step 1: Write failing tests for `lib/jackett.ts`**

Create `__tests__/api/jackett.test.ts`:

```ts
import { searchTorrents } from '@/lib/jackett'

global.fetch = jest.fn()

afterEach(() => jest.resetAllMocks())

test('searchTorrents returns normalised results', async () => {
  ;(fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      Results: [
        {
          Title: 'The.Matrix.1080p.mkv',
          Size: 8_800_000_000,
          Seeders: 142,
          MagnetUri: 'magnet:?xt=...',
          CategoryDesc: 'Movies',
        },
      ],
    }),
  })

  const results = await searchTorrents('http://localhost:9117', 'abc123', 'matrix')
  expect(results).toHaveLength(1)
  expect(results[0]).toMatchObject({
    title: 'The.Matrix.1080p.mkv',
    seeders: 142,
    magnetUri: 'magnet:?xt=...',
  })
})

test('searchTorrents throws on non-ok response', async () => {
  ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401 })
  await expect(searchTorrents('http://localhost:9117', 'bad', 'matrix')).rejects.toThrow('401')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/jackett.test.ts --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Create `lib/jackett.ts`**

```ts
export interface TorrentResult {
  title: string
  size: number        // bytes
  seeders: number
  magnetUri: string
  category: string
}

export async function searchTorrents(
  baseUrl: string,
  apiKey: string,
  query: string,
): Promise<TorrentResult[]> {
  const url = new URL('/api/v2.0/indexers/all/results', baseUrl)
  url.searchParams.set('apikey', apiKey)
  url.searchParams.set('Query', query)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Jackett error: ${res.status}`)

  const data = await res.json()
  return (data.Results ?? []).map((r: Record<string, unknown>) => ({
    title: r.Title as string,
    size: r.Size as number,
    seeders: r.Seeders as number,
    magnetUri: r.MagnetUri as string,
    category: r.CategoryDesc as string,
  }))
}

export async function testConnection(baseUrl: string, apiKey: string): Promise<boolean> {
  try {
    const url = new URL('/api/v2.0/indexers/all/results', baseUrl)
    url.searchParams.set('apikey', apiKey)
    url.searchParams.set('Query', 'test')
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/jackett.test.ts --no-coverage
```
Expected: PASS

- [ ] **Step 5: Create `app/api/search/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'
import { searchTorrents } from '@/lib/jackett'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 })

  const config = await readConfig()
  if (!config.jackett.apiKey) {
    return NextResponse.json({ error: 'Jackett not configured' }, { status: 503 })
  }

  try {
    const results = await searchTorrents(config.jackett.url, config.jackett.apiKey, query)
    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
```

- [ ] **Step 6: Create `app/api/test/jackett/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'
import { testConnection } from '@/lib/jackett'

export async function GET() {
  const config = await readConfig()
  const ok = await testConnection(config.jackett.url, config.jackett.apiKey)
  return NextResponse.json({ ok })
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/jackett.ts app/api/search/route.ts app/api/test/jackett/route.ts __tests__/api/jackett.test.ts
git commit -m "feat: Jackett client, search API, and connection test"
```

---

## Task 4: qBittorrent Client + Torrent API

**Files:**
- Create: `lib/qbittorrent.ts`
- Create: `app/api/torrents/route.ts`
- Create: `app/api/torrents/[hash]/route.ts`
- Create: `app/api/test/qbittorrent/route.ts`
- Create: `__tests__/api/qbittorrent.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/qbittorrent.test.ts`:

```ts
import { QBittorrentClient } from '@/lib/qbittorrent'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

function mockFetch(...responses: object[]) {
  for (const r of responses) {
    ;(fetch as jest.Mock).mockResolvedValueOnce(r)
  }
}

test('getTorrents returns list', async () => {
  mockFetch(
    { ok: true, text: async () => 'Ok' },         // login
    { ok: true, json: async () => [{ hash: 'abc', name: 'Movie', progress: 0.5 }] }, // list
  )
  const client = new QBittorrentClient('http://localhost:8080', 'admin', 'pass')
  const result = await client.getTorrents()
  expect(result[0].hash).toBe('abc')
})

test('addMagnet posts to qBit', async () => {
  mockFetch(
    { ok: true, text: async () => 'Ok' },   // login
    { ok: true, text: async () => 'Ok' },   // add
  )
  const client = new QBittorrentClient('http://localhost:8080', 'admin', 'pass')
  await expect(client.addMagnet('magnet:?xt=...')).resolves.not.toThrow()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/qbittorrent.test.ts --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Create `lib/qbittorrent.ts`**

```ts
export interface Torrent {
  hash: string
  name: string
  progress: number   // 0-1
  dlspeed: number    // bytes/s
  eta: number        // seconds
  size: number       // bytes
  state: string      // 'downloading' | 'uploading' | 'pausedDL' | 'stalledDL' | 'error' | 'checkingDL' | ...
  savePath: string
  contentPath: string
}

export class QBittorrentClient {
  private cookie = ''

  constructor(
    private baseUrl: string,
    private username: string,
    private password: string,
  ) {}

  private async login(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v2/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: this.username, password: this.password }),
    })
    const setCookie = res.headers.get('set-cookie') ?? ''
    this.cookie = setCookie.split(';')[0]
  }

  private async call(path: string, init?: RequestInit): Promise<Response> {
    await this.login()
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Cookie: this.cookie },
    })
  }

  async getTorrents(): Promise<Torrent[]> {
    const res = await this.call('/api/v2/torrents/info')
    return res.json()
  }

  async addMagnet(magnetUri: string, savePath?: string): Promise<void> {
    const body = new URLSearchParams({ urls: magnetUri })
    if (savePath) body.set('savepath', savePath)
    await this.call('/api/v2/torrents/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  }

  async deleteTorrent(hash: string, deleteFiles: boolean): Promise<void> {
    const body = new URLSearchParams({ hashes: hash, deleteFiles: String(deleteFiles) })
    await this.call('/api/v2/torrents/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.login()
      return this.cookie !== ''
    } catch {
      return false
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/qbittorrent.test.ts --no-coverage
```
Expected: PASS

- [ ] **Step 5: Create `app/api/torrents/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'
import { QBittorrentClient } from '@/lib/qbittorrent'

async function makeClient() {
  const cfg = await readConfig()
  return new QBittorrentClient(cfg.qbittorrent.url, cfg.qbittorrent.username, cfg.qbittorrent.password)
}

export async function GET() {
  try {
    const client = await makeClient()
    const torrents = await client.getTorrents()
    return NextResponse.json(torrents)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const { magnetUri } = await req.json()
  if (!magnetUri) return NextResponse.json({ error: 'Missing magnetUri' }, { status: 400 })

  const cfg = await readConfig()
  const client = await makeClient()
  await client.addMagnet(magnetUri, cfg.plexFolder || undefined)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Create `app/api/torrents/[hash]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { QBittorrentClient } from '@/lib/qbittorrent'
import { readConfig } from '@/lib/config'

export async function DELETE(
  req: Request,
  { params }: { params: { hash: string } },
) {
  const { deleteFiles } = await req.json().catch(() => ({ deleteFiles: false }))
  const cfg = await readConfig()
  const client = new QBittorrentClient(
    cfg.qbittorrent.url,
    cfg.qbittorrent.username,
    cfg.qbittorrent.password,
  )
  await client.deleteTorrent(params.hash, !!deleteFiles)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Create `app/api/test/qbittorrent/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'
import { QBittorrentClient } from '@/lib/qbittorrent'

export async function GET() {
  const cfg = await readConfig()
  const client = new QBittorrentClient(cfg.qbittorrent.url, cfg.qbittorrent.username, cfg.qbittorrent.password)
  const ok = await client.testConnection()
  return NextResponse.json({ ok })
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/qbittorrent.ts app/api/torrents/ app/api/test/qbittorrent/ __tests__/api/qbittorrent.test.ts
git commit -m "feat: qBittorrent client and torrent management API routes"
```

---

## Task 5: File Cleanup Logic

**Files:**
- Create: `lib/cleanup.ts`
- Create: `__tests__/api/cleanup.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/cleanup.test.ts`:

```ts
import { cleanupDownload } from '@/lib/cleanup'
import fs from 'fs'
import path from 'path'
import os from 'os'

function makeTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-test-'))
  return dir
}

test('moves video files to Plex folder', async () => {
  const src = makeTmp()
  const dest = makeTmp()
  fs.writeFileSync(path.join(src, 'movie.mkv'), 'data')
  fs.writeFileSync(path.join(src, 'movie.nfo'), 'info')

  await cleanupDownload(src, dest)

  expect(fs.existsSync(path.join(dest, 'movie.mkv'))).toBe(true)
  expect(fs.existsSync(path.join(src, 'movie.nfo'))).toBe(false)
  expect(fs.existsSync(src)).toBe(false) // src dir removed
})

test('renames on collision', async () => {
  const src = makeTmp()
  const dest = makeTmp()
  fs.writeFileSync(path.join(dest, 'movie.mkv'), 'existing')
  fs.writeFileSync(path.join(src, 'movie.mkv'), 'new')

  await cleanupDownload(src, dest)

  expect(fs.existsSync(path.join(dest, 'movie.mkv'))).toBe(true)
  expect(fs.existsSync(path.join(dest, 'movie-1.mkv'))).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/cleanup.test.ts --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Create `lib/cleanup.ts`**

```ts
import fs from 'fs/promises'
import path from 'path'

const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.avi', '.mov', '.ts', '.m4v'])

function isVideo(filename: string): boolean {
  return VIDEO_EXTENSIONS.has(path.extname(filename).toLowerCase())
}

async function resolveConflict(dest: string): Promise<string> {
  let counter = 1
  const ext = path.extname(dest)
  const base = dest.slice(0, -ext.length)
  let candidate = dest
  while (true) {
    try {
      await fs.access(candidate)
      candidate = `${base}-${counter}${ext}`
      counter++
    } catch {
      return candidate
    }
  }
}

export async function cleanupDownload(srcDir: string, plexFolder: string): Promise<void> {
  const entries = await fs.readdir(srcDir, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name)
    if (entry.isFile() && isVideo(entry.name)) {
      const rawDest = path.join(plexFolder, entry.name)
      const destPath = await resolveConflict(rawDest)
      await fs.rename(srcPath, destPath)
    }
  }

  // Delete remaining non-video files and the source directory
  const remaining = await fs.readdir(srcDir)
  for (const name of remaining) {
    await fs.rm(path.join(srcDir, name), { recursive: true, force: true })
  }
  await fs.rmdir(srcDir)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/cleanup.test.ts --no-coverage
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/cleanup.ts __tests__/api/cleanup.test.ts
git commit -m "feat: post-download file cleanup logic"
```

---

## Task 6: Library API

**Files:**
- Create: `app/api/library/route.ts`
- Create: `app/api/library/[filename]/route.ts`
- Create: `__tests__/api/library.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/library.test.ts`:

```ts
import { listVideoFiles, deleteVideoFile } from '@/lib/library'
import fs from 'fs'
import path from 'path'
import os from 'os'

let tmpDir: string
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-test-')) })
afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }) })

test('listVideoFiles returns only video files', async () => {
  fs.writeFileSync(path.join(tmpDir, 'a.mkv'), '')
  fs.writeFileSync(path.join(tmpDir, 'b.txt'), '')
  const files = await listVideoFiles(tmpDir)
  expect(files.map(f => f.name)).toEqual(['a.mkv'])
})

test('deleteVideoFile removes the file', async () => {
  fs.writeFileSync(path.join(tmpDir, 'c.mp4'), '')
  await deleteVideoFile(tmpDir, 'c.mp4')
  expect(fs.existsSync(path.join(tmpDir, 'c.mp4'))).toBe(false)
})

test('deleteVideoFile rejects path traversal', async () => {
  await expect(deleteVideoFile(tmpDir, '../etc/passwd')).rejects.toThrow()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/library.test.ts --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Create `lib/library.ts`**

```ts
import fs from 'fs/promises'
import path from 'path'

const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.avi', '.mov', '.ts', '.m4v'])

export interface VideoFile {
  name: string
  size: number
  modified: string   // ISO date string
}

export async function listVideoFiles(folder: string): Promise<VideoFile[]> {
  const entries = await fs.readdir(folder, { withFileTypes: true })
  const results: VideoFile[] = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue
    const stat = await fs.stat(path.join(folder, entry.name))
    results.push({ name: entry.name, size: stat.size, modified: stat.mtime.toISOString() })
  }
  return results
}

export async function deleteVideoFile(folder: string, filename: string): Promise<void> {
  // Guard against path traversal
  const resolved = path.resolve(folder, filename)
  if (!resolved.startsWith(path.resolve(folder) + path.sep)) {
    throw new Error('Invalid filename')
  }
  await fs.unlink(resolved)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/library.test.ts --no-coverage
```
Expected: PASS

- [ ] **Step 5: Create `app/api/library/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'
import { listVideoFiles } from '@/lib/library'

export async function GET() {
  const cfg = await readConfig()
  if (!cfg.plexFolder) return NextResponse.json([])
  try {
    const files = await listVideoFiles(cfg.plexFolder)
    return NextResponse.json(files)
  } catch {
    return NextResponse.json([])
  }
}
```

- [ ] **Step 6: Create `app/api/library/[filename]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'
import { deleteVideoFile } from '@/lib/library'

export async function DELETE(
  _req: Request,
  { params }: { params: { filename: string } },
) {
  const cfg = await readConfig()
  try {
    await deleteVideoFile(cfg.plexFolder, decodeURIComponent(params.filename))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/library.ts app/api/library/ __tests__/api/library.test.ts
git commit -m "feat: library API — list and delete video files"
```

---

## Task 7: SSE Stream + Auto-Cleanup Trigger

**Files:**
- Create: `app/api/stream/route.ts`
- Create: `lib/torrent-monitor.ts`
- Create: `__tests__/api/torrent-monitor.test.ts`

- [ ] **Step 1: Write failing tests for monitor logic**

Create `__tests__/api/torrent-monitor.test.ts`:

```ts
import { detectCompleted } from '@/lib/torrent-monitor'
import type { Torrent } from '@/lib/qbittorrent'

function t(hash: string, state: string): Torrent {
  return { hash, name: 'test', progress: 1, dlspeed: 0, eta: 0, size: 0, state, savePath: '/tmp', contentPath: '/tmp/test' }
}

test('detectCompleted returns hashes that just completed', () => {
  const prev = [t('aaa', 'downloading'), t('bbb', 'uploading')]
  const curr = [t('aaa', 'uploading'), t('bbb', 'uploading')]
  expect(detectCompleted(prev, curr)).toEqual(['aaa'])
})

test('detectCompleted ignores already-completed torrents', () => {
  const prev = [t('aaa', 'uploading')]
  const curr = [t('aaa', 'uploading')]
  expect(detectCompleted(prev, curr)).toEqual([])
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/torrent-monitor.test.ts --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Create `lib/torrent-monitor.ts`**

```ts
import type { Torrent } from '@/lib/qbittorrent'

const DONE_STATES = new Set(['uploading', 'stalledUP', 'queuedUP', 'checkingUP', 'forcedUP'])

export function detectCompleted(prev: Torrent[], curr: Torrent[]): string[] {
  const prevMap = new Map(prev.map(t => [t.hash, t.state]))
  return curr
    .filter(t => DONE_STATES.has(t.state) && !DONE_STATES.has(prevMap.get(t.hash) ?? ''))
    .map(t => t.hash)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/torrent-monitor.test.ts --no-coverage
```
Expected: PASS

- [ ] **Step 5: Create `app/api/stream/route.ts`**

```ts
import { readConfig } from '@/lib/config'
import { QBittorrentClient, Torrent } from '@/lib/qbittorrent'
import { detectCompleted } from '@/lib/torrent-monitor'
import { cleanupDownload } from '@/lib/cleanup'

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

      let prevTorrents: Torrent[] = []

      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      while (true) {
        try {
          const torrents = await client.getTorrents()

          // Detect and handle newly-completed downloads
          const completed = detectCompleted(prevTorrents, torrents)
          for (const hash of completed) {
            const torrent = torrents.find(t => t.hash === hash)
            if (torrent && cfg.plexFolder) {
              await cleanupDownload(torrent.contentPath, cfg.plexFolder).catch(console.error)
            }
          }

          prevTorrents = torrents
          send(torrents)
        } catch {
          send({ error: 'qBittorrent unreachable' })
        }

        await new Promise(r => setTimeout(r, 2000))
      }
    },
    cancel() { /* client disconnected — loop will stop on next gc */ },
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

- [ ] **Step 6: Commit**

```bash
git add lib/torrent-monitor.ts app/api/stream/route.ts __tests__/api/torrent-monitor.test.ts
git commit -m "feat: SSE stream with auto-cleanup on torrent completion"
```

---

## Task 8: Root Layout + Sidebar

**Files:**
- Create: `components/Sidebar.tsx`
- Modify: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `__tests__/components/Sidebar.test.tsx`

- [ ] **Step 1: Write failing component test**

Create `__tests__/components/Sidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/Sidebar'

// Mock next/navigation
jest.mock('next/navigation', () => ({ usePathname: () => '/search' }))

test('renders all four nav links', () => {
  render(<Sidebar />)
  expect(screen.getByText('Cerca')).toBeInTheDocument()
  expect(screen.getByText('Download')).toBeInTheDocument()
  expect(screen.getByText('Libreria')).toBeInTheDocument()
  expect(screen.getByText('Impostazioni')).toBeInTheDocument()
})

test('highlights active link', () => {
  render(<Sidebar />)
  const link = screen.getByText('Cerca').closest('a')
  expect(link?.className).toMatch(/bg-/)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/Sidebar.test.tsx --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Create `components/Sidebar.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Download, FolderVideo, Settings } from 'lucide-react'

const links = [
  { href: '/search', label: 'Cerca', icon: Search },
  { href: '/downloads', label: 'Download', icon: Download },
  { href: '/library', label: 'Libreria', icon: FolderVideo },
  { href: '/settings', label: 'Impostazioni', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 flex-shrink-0 h-screen bg-gray-900 flex flex-col p-4 gap-2 border-r border-gray-800">
      <div className="text-purple-400 font-bold text-lg mb-6">🎬 FeedMyPlex</div>
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            pathname.startsWith(href)
              ? 'bg-purple-700/30 text-purple-300'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </aside>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/Sidebar.test.tsx --no-coverage
```
Expected: PASS

- [ ] **Step 5: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'

export const metadata: Metadata = { title: 'FeedMyPlex' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className="dark">
      <body className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Create `app/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
export default function Home() { redirect('/search') }
```

- [ ] **Step 7: Install lucide-react**

```bash
npm install lucide-react
```

- [ ] **Step 8: Commit**

```bash
git add components/Sidebar.tsx app/layout.tsx app/page.tsx __tests__/components/Sidebar.test.tsx
git commit -m "feat: root layout with sidebar navigation"
```

---

## Task 9: Settings Page

**Files:**
- Create: `app/settings/page.tsx`

- [ ] **Step 1: Create `app/settings/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Config = {
  plexFolder: string
  jackett: { url: string; apiKey: string }
  qbittorrent: { url: string; username: string; password: string }
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [saved, setSaved] = useState(false)
  const [tests, setTests] = useState<Record<string, boolean | null>>({})

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setCfg)
  }, [])

  const save = async () => {
    await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const test = async (service: 'jackett' | 'qbittorrent') => {
    setTests(t => ({ ...t, [service]: null }))
    const res = await fetch(`/api/test/${service}`)
    const { ok } = await res.json()
    setTests(t => ({ ...t, [service]: ok }))
  }

  if (!cfg) return <p className="text-gray-500">Caricamento...</p>

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Impostazioni</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase">Cartella Plex</h2>
        <Input value={cfg.plexFolder} onChange={e => setCfg({ ...cfg, plexFolder: e.target.value })} placeholder="/mnt/media/plex" />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase flex justify-between">
          Jackett
          <button onClick={() => test('jackett')} className="text-xs text-purple-400 hover:underline">
            {tests.jackett === null ? '...' : tests.jackett === true ? '✅ OK' : tests.jackett === false ? '❌ Errore' : 'Test connessione'}
          </button>
        </h2>
        <Input value={cfg.jackett.url} onChange={e => setCfg({ ...cfg, jackett: { ...cfg.jackett, url: e.target.value } })} placeholder="http://localhost:9117" />
        <Input value={cfg.jackett.apiKey} onChange={e => setCfg({ ...cfg, jackett: { ...cfg.jackett, apiKey: e.target.value } })} placeholder="API Key" />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase flex justify-between">
          qBittorrent
          <button onClick={() => test('qbittorrent')} className="text-xs text-purple-400 hover:underline">
            {tests.qbittorrent === null ? '...' : tests.qbittorrent === true ? '✅ OK' : tests.qbittorrent === false ? '❌ Errore' : 'Test connessione'}
          </button>
        </h2>
        <Input value={cfg.qbittorrent.url} onChange={e => setCfg({ ...cfg, qbittorrent: { ...cfg.qbittorrent, url: e.target.value } })} placeholder="http://localhost:8080" />
        <Input value={cfg.qbittorrent.username} onChange={e => setCfg({ ...cfg, qbittorrent: { ...cfg.qbittorrent, username: e.target.value } })} placeholder="admin" />
        <Input type="password" value={cfg.qbittorrent.password} onChange={e => setCfg({ ...cfg, qbittorrent: { ...cfg.qbittorrent, password: e.target.value } })} placeholder="Password" />
      </section>

      <Button onClick={save}>{saved ? 'Salvato ✓' : 'Salva'}</Button>
    </div>
  )
}
```

- [ ] **Step 2: Run the dev server and verify the settings page renders**

```bash
npm run dev
```
Open http://localhost:3000/settings — form should render with all fields.

- [ ] **Step 3: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat: settings page with config form and connection tests"
```

---

## Task 10: Search Page

**Files:**
- Create: `components/SearchResults.tsx`
- Create: `app/search/page.tsx`
- Create: `__tests__/components/SearchResults.test.tsx`

- [ ] **Step 1: Write failing component test**

Create `__tests__/components/SearchResults.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchResults } from '@/components/SearchResults'

const results = [
  { title: 'The.Matrix.1080p.mkv', size: 8_800_000_000, seeders: 142, magnetUri: 'magnet:?xt=...', category: 'Movies' },
]

test('renders result rows', () => {
  render(<SearchResults results={results} onDownload={jest.fn()} />)
  expect(screen.getByText('The.Matrix.1080p.mkv')).toBeInTheDocument()
  expect(screen.getByText('142')).toBeInTheDocument()
})

test('calls onDownload with magnetUri', () => {
  const onDownload = jest.fn()
  render(<SearchResults results={results} onDownload={onDownload} />)
  fireEvent.click(screen.getByRole('button', { name: /scarica/i }))
  expect(onDownload).toHaveBeenCalledWith('magnet:?xt=...')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/SearchResults.test.tsx --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Create `components/SearchResults.tsx`**

```tsx
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface TorrentResult {
  title: string
  size: number
  seeders: number
  magnetUri: string
  category: string
}

function formatBytes(bytes: number) {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  return `${(bytes / 1e6).toFixed(0)} MB`
}

function resolutionBadge(title: string) {
  if (/4k|2160p/i.test(title)) return '4K'
  if (/1080p/i.test(title)) return '1080p'
  if (/720p/i.test(title)) return '720p'
  return null
}

export function SearchResults({
  results,
  onDownload,
}: {
  results: TorrentResult[]
  onDownload: (magnet: string) => void
}) {
  if (results.length === 0) return <p className="text-gray-500 mt-4">Nessun risultato.</p>

  return (
    <table className="w-full text-sm mt-4">
      <thead>
        <tr className="text-gray-400 border-b border-gray-800 text-left">
          <th className="pb-2">Nome</th>
          <th className="pb-2 w-24">Dim.</th>
          <th className="pb-2 w-20">Seed</th>
          <th className="pb-2 w-28"></th>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const badge = resolutionBadge(r.title)
          return (
            <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              <td className="py-2 pr-4 flex items-center gap-2">
                {r.title}
                {badge && <Badge variant="secondary">{badge}</Badge>}
              </td>
              <td className="py-2 text-gray-400">{formatBytes(r.size)}</td>
              <td className={`py-2 ${r.seeders > 50 ? 'text-green-400' : r.seeders > 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                {r.seeders}
              </td>
              <td className="py-2">
                <Button size="sm" onClick={() => onDownload(r.magnetUri)}>Scarica</Button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/SearchResults.test.tsx --no-coverage
```
Expected: PASS

- [ ] **Step 5: Create `app/search/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SearchResults, TorrentResult } from '@/components/SearchResults'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TorrentResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Errore'); return }
    setResults(data)
  }

  const download = async (magnetUri: string) => {
    const res = await fetch('/api/torrents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ magnetUri }),
    })
    setToast(res.ok ? 'Torrent aggiunto! ✓' : 'Errore nell\'aggiunta.')
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Cerca Torrent</h1>
      {toast && <div className="mb-4 text-sm text-green-400 bg-green-900/30 px-4 py-2 rounded">{toast}</div>}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Cerca film o serie..."
          className="max-w-md"
        />
        <Button onClick={search} disabled={loading}>{loading ? 'Cercando...' : 'Cerca'}</Button>
      </div>
      {error && <p className="text-red-400 mt-3 text-sm">{error} — <a href="/settings" className="underline">Controlla le impostazioni</a></p>}
      <SearchResults results={results} onDownload={download} />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/SearchResults.tsx app/search/page.tsx __tests__/components/SearchResults.test.tsx
git commit -m "feat: search page with torrent results table"
```

---

## Task 11: Downloads Page

**Files:**
- Create: `components/TorrentRow.tsx`
- Create: `app/downloads/page.tsx`
- Modify: `app/api/torrents/route.ts` (add PATCH for pause/resume)
- Create: `__tests__/components/TorrentRow.test.tsx`

- [ ] **Step 1: Write failing test**

Create `__tests__/components/TorrentRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { TorrentRow } from '@/components/TorrentRow'

const torrent = {
  hash: 'abc', name: 'The.Matrix.mkv', progress: 0.65,
  dlspeed: 4_200_000, eta: 240, size: 8_800_000_000,
  state: 'downloading', savePath: '/tmp', contentPath: '/tmp/movie',
}

test('renders torrent name and progress', () => {
  render(<table><tbody><TorrentRow torrent={torrent} onDelete={jest.fn()} /></tbody></table>)
  expect(screen.getByText('The.Matrix.mkv')).toBeInTheDocument()
  expect(screen.getByText('65%')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/TorrentRow.test.tsx --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Create `components/TorrentRow.tsx`**

```tsx
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Torrent } from '@/lib/qbittorrent'

function formatSpeed(bps: number) {
  return bps > 1e6 ? `${(bps / 1e6).toFixed(1)} MB/s` : `${(bps / 1e3).toFixed(0)} KB/s`
}

function formatEta(secs: number) {
  if (secs > 86400 || secs < 0) return '∞'
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
}: {
  torrent: Torrent
  onDelete: (hash: string, deleteFiles: boolean) => void
  onTogglePause: (hash: string, paused: boolean) => void
}) {
  const pct = Math.round(torrent.progress * 100)
  const label = STATE_LABELS[torrent.state] ?? torrent.state
  const isPaused = torrent.state === 'pausedDL'
  return (
    <tr className="border-b border-gray-800/50">
      <td className="py-3 pr-4">
        <p className="font-medium truncate max-w-xs">{torrent.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <Progress value={pct} className="h-1.5 w-40" />
          <span className="text-xs text-gray-400">{pct}%</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">{formatSpeed(torrent.dlspeed)} · ETA {formatEta(torrent.eta)}</p>
      </td>
      <td className="py-3">
        <Badge variant={torrent.state === 'error' ? 'destructive' : 'secondary'}>{label}</Badge>
      </td>
      <td className="py-3 text-right space-x-2">
        <Button size="sm" variant="outline" onClick={() => onTogglePause(torrent.hash, isPaused)}>
          {isPaused ? 'Riprendi' : 'Pausa'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDelete(torrent.hash, false)}>Rimuovi</Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(torrent.hash, true)}>+ File</Button>
      </td>
    </tr>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/TorrentRow.test.tsx --no-coverage
```
Expected: PASS

- [ ] **Step 5: Create `app/downloads/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { TorrentRow } from '@/components/TorrentRow'
import type { Torrent } from '@/lib/qbittorrent'

export default function DownloadsPage() {
  const [torrents, setTorrents] = useState<Torrent[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const es = new EventSource('/api/stream')
    es.onmessage = e => {
      const data = JSON.parse(e.data)
      if (Array.isArray(data)) setTorrents(data)
      else setError('qBittorrent non raggiungibile')
    }
    es.onerror = () => setError('Connessione SSE interrotta')
    return () => es.close()
  }, [])

  const deleteTorrent = async (hash: string, deleteFiles: boolean) => {
    await fetch(`/api/torrents/${hash}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteFiles }),
    })
  }

  const togglePause = async (hash: string, isPaused: boolean) => {
    await fetch('/api/torrents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash, action: isPaused ? 'resume' : 'pause' }),
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Download</h1>
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {torrents.length === 0 && !error && <p className="text-gray-500">Nessun download attivo.</p>}
      <table className="w-full">
        <tbody>
          {torrents.map(t => (
            <TorrentRow key={t.hash} torrent={t} onDelete={deleteTorrent} onTogglePause={togglePause} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 6: Add pause/resume to `lib/qbittorrent.ts`**

Add two methods to `QBittorrentClient`:

```ts
async pauseTorrent(hash: string): Promise<void> {
  const body = new URLSearchParams({ hashes: hash })
  await this.call('/api/v2/torrents/pause', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
}

async resumeTorrent(hash: string): Promise<void> {
  const body = new URLSearchParams({ hashes: hash })
  await this.call('/api/v2/torrents/resume', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
}
```

- [ ] **Step 7: Add PATCH handler to `app/api/torrents/route.ts`**

```ts
export async function PATCH(req: Request) {
  const { hash, action } = await req.json()  // action: 'pause' | 'resume'
  const client = await makeClient()
  if (action === 'pause') await client.pauseTorrent(hash)
  else await client.resumeTorrent(hash)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 8: Verify `app/downloads/page.tsx` already includes `togglePause` (added in Step 5)**

The `togglePause` function and `onTogglePause` prop were included in Step 5. No additional changes needed — proceed to step 9.

- [ ] **Step 9: Commit**

```bash
git add components/TorrentRow.tsx app/downloads/page.tsx app/api/torrents/route.ts lib/qbittorrent.ts __tests__/components/TorrentRow.test.tsx
git commit -m "feat: downloads page with real-time SSE progress and pause/resume"
```

---

## Task 12: Library Page

**Files:**
- Create: `components/LibraryTable.tsx`
- Create: `app/library/page.tsx`
- Create: `__tests__/components/LibraryTable.test.tsx`

- [ ] **Step 1: Write failing test**

Create `__tests__/components/LibraryTable.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { LibraryTable } from '@/components/LibraryTable'

const files = [
  { name: 'movie.mkv', size: 8_800_000_000, modified: '2026-03-01T00:00:00Z' },
]

test('renders file name', () => {
  render(<LibraryTable files={files} onDelete={jest.fn()} />)
  expect(screen.getByText('movie.mkv')).toBeInTheDocument()
})

test('calls onDelete when confirmed', () => {
  const onDelete = jest.fn()
  window.confirm = jest.fn(() => true)
  render(<LibraryTable files={files} onDelete={onDelete} />)
  fireEvent.click(screen.getByRole('button', { name: /elimina/i }))
  expect(onDelete).toHaveBeenCalledWith('movie.mkv')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/LibraryTable.test.tsx --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Create `components/LibraryTable.tsx`**

```tsx
import { Button } from '@/components/ui/button'

export interface VideoFile { name: string; size: number; modified: string }

function formatBytes(bytes: number) {
  return bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`
}

export function LibraryTable({ files, onDelete }: { files: VideoFile[]; onDelete: (name: string) => void }) {
  if (files.length === 0) return <p className="text-gray-500 mt-4">Nessun file video trovato.</p>

  return (
    <table className="w-full text-sm mt-4">
      <thead>
        <tr className="text-gray-400 border-b border-gray-800 text-left">
          <th className="pb-2">File</th>
          <th className="pb-2 w-24">Dim.</th>
          <th className="pb-2 w-40">Modificato</th>
          <th className="pb-2 w-24"></th>
        </tr>
      </thead>
      <tbody>
        {files.map(f => (
          <tr key={f.name} className="border-b border-gray-800/50 hover:bg-gray-900/50">
            <td className="py-2 pr-4">{f.name}</td>
            <td className="py-2 text-gray-400">{formatBytes(f.size)}</td>
            <td className="py-2 text-gray-400">{new Date(f.modified).toLocaleDateString('it')}</td>
            <td className="py-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => window.confirm(`Eliminare "${f.name}"?`) && onDelete(f.name)}
              >
                Elimina
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/LibraryTable.test.tsx --no-coverage
```
Expected: PASS

- [ ] **Step 5: Create `app/library/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { LibraryTable, VideoFile } from '@/components/LibraryTable'

export default function LibraryPage() {
  const [files, setFiles] = useState<VideoFile[]>([])

  const load = () => fetch('/api/library').then(r => r.json()).then(setFiles)
  useEffect(() => { load() }, [])

  const del = async (name: string) => {
    await fetch(`/api/library/${encodeURIComponent(name)}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Libreria Plex</h1>
      <LibraryTable files={files} onDelete={del} />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/LibraryTable.tsx app/library/page.tsx __tests__/components/LibraryTable.test.tsx
git commit -m "feat: library page with file list and delete"
```

---

## Task 13: Full Test Run + Config Guard

**Files:**
- Modify: `app/layout.tsx` (add config check redirect)

- [ ] **Step 1: Run full test suite**

```bash
npx jest --no-coverage
```
Expected: All tests PASS. Fix any failures before continuing.

- [ ] **Step 2: Add config-missing guard to Search and Downloads pages**

In `app/search/page.tsx`, add a config check at the top of the component (runs on mount):

```tsx
// Add to SearchPage component, inside useEffect:
useEffect(() => {
  fetch('/api/config')
    .then(r => r.json())
    .then((cfg) => {
      if (!cfg.plexFolder || !cfg.jackett?.apiKey) {
        setError('Configura Jackett e la cartella Plex prima di cercare.')
      }
    })
}, [])
```

Replace the `useEffect` in `app/downloads/page.tsx` with this version that checks config first:

```tsx
useEffect(() => {
  let es: EventSource | null = null

  fetch('/api/config')
    .then(r => r.json())
    .then((cfg) => {
      if (!cfg.qbittorrent?.url || !cfg.plexFolder) {
        setError('Configura qBittorrent e la cartella Plex nelle impostazioni.')
        return
      }
      es = new EventSource('/api/stream')
      es.onmessage = e => {
        const data = JSON.parse(e.data)
        if (Array.isArray(data)) setTorrents(data)
        else setError('qBittorrent non raggiungibile')
      }
      es.onerror = () => setError('Connessione SSE interrotta')
    })

  return () => es?.close()
}, [])
```

Both pages' error display already includes `<a href="/settings" className="underline">Impostazioni</a>`. Update the error JSX in `downloads/page.tsx` to include that link:

```tsx
{error && (
  <p className="text-red-400 text-sm mb-4">
    {error} — <a href="/settings" className="underline">Controlla le impostazioni</a>
  </p>
)}
```

- [ ] **Step 3: Build the project**

```bash
npm run build
```
Expected: Build completes without TypeScript errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete FeedMyPlex app — all pages and API routes"
```
