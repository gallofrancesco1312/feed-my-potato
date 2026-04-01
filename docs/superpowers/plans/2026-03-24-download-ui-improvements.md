# Download UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the download section with descriptive Italian state labels, full torrent title display, and a per-torrent SVG sparkline showing download speed history.

**Architecture:** All changes are confined to two files. `TorrentRow.tsx` receives updated labels, title fix, and a new `SpeedSparkline` inline component. `downloads/page.tsx` accumulates speed history in a `useRef` Map and passes it to each `TorrentRow`.

**Tech Stack:** React 19, Next.js 16, Tailwind CSS v4, pure SVG (no charting library), Jest + React Testing Library

---

## File Map

| File | Changes |
|---|---|
| `components/TorrentRow.tsx` | Update `STATE_LABELS`, fix `isPaused`, remove title truncation, add `SpeedSparkline` component, add `speedHistory` prop |
| `app/downloads/page.tsx` | Add `speedHistoryRef`, accumulate history on SSE updates, cleanup on delete, pass `speedHistory` prop |
| `__tests__/components/TorrentRow.test.tsx` | Extend existing tests: state labels, full title, sparkline render |

---

## Task 1: State labels + isPaused fix

**Files:**
- Modify: `components/TorrentRow.tsx:17-37`
- Test: `__tests__/components/TorrentRow.test.tsx`

- [ ] **Step 1: Write failing tests for new state labels and isPaused**

Replace the entire test file content with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TorrentRow } from '@/components/TorrentRow'

const base = {
  hash: 'abc', name: 'The.Matrix.mkv', progress: 0.65,
  dlspeed: 4_200_000, eta: 240, size: 8_800_000_000,
  savePath: '/tmp', contentPath: '/tmp/movie',
}

function wrap(torrent: typeof base & { state: string }, speedHistory: number[] = []) {
  return render(
    <table><tbody>
      <TorrentRow torrent={torrent} onDelete={jest.fn()} onTogglePause={jest.fn()} speedHistory={speedHistory} />
    </tbody></table>
  )
}

test('renders torrent name and progress', () => {
  wrap({ ...base, state: 'downloading' })
  expect(screen.getByText('The.Matrix.mkv')).toBeInTheDocument()
  expect(screen.getByText('65%')).toBeInTheDocument()
})

test('state label: downloading → In download', () => {
  wrap({ ...base, state: 'downloading' })
  expect(screen.getByText('In download')).toBeInTheDocument()
})

test('state label: uploading → In seeding', () => {
  wrap({ ...base, state: 'uploading' })
  expect(screen.getByText('In seeding')).toBeInTheDocument()
})

test('state label: pausedDL → In pausa', () => {
  wrap({ ...base, state: 'pausedDL' })
  expect(screen.getByText('In pausa')).toBeInTheDocument()
})

test('state label: pausedUP → In pausa', () => {
  wrap({ ...base, state: 'pausedUP' })
  expect(screen.getByText('In pausa')).toBeInTheDocument()
})

test('state label: stalledDL → In attesa', () => {
  wrap({ ...base, state: 'stalledDL' })
  expect(screen.getByText('In attesa')).toBeInTheDocument()
})

test('state label: queuedDL → In coda', () => {
  wrap({ ...base, state: 'queuedDL' })
  expect(screen.getByText('In coda')).toBeInTheDocument()
})

test('isPaused: pausedUP shows Riprendi button', () => {
  wrap({ ...base, state: 'pausedUP' })
  expect(screen.getByRole('button', { name: 'Riprendi' })).toBeInTheDocument()
})

test('isPaused: downloading shows Pausa button', () => {
  wrap({ ...base, state: 'downloading' })
  expect(screen.getByRole('button', { name: 'Pausa' })).toBeInTheDocument()
})

test('title is not truncated (no max-w-xs class)', () => {
  wrap({ ...base, state: 'downloading', name: 'A.Very.Long.Movie.Title.That.Would.Normally.Be.Truncated.mkv' })
  const title = screen.getByText('A.Very.Long.Movie.Title.That.Would.Normally.Be.Truncated.mkv')
  expect(title.className).not.toContain('truncate')
  expect(title.className).not.toContain('max-w-xs')
})

test('sparkline renders svg', () => {
  const { container } = wrap({ ...base, state: 'downloading' }, [1000, 2000, 3000])
  expect(container.querySelector('svg')).toBeInTheDocument()
})

test('sparkline: no NaN when no history', () => {
  const { container } = wrap({ ...base, state: 'downloading' }, [])
  const polyline = container.querySelector('polyline')!
  expect(polyline.getAttribute('points')).not.toContain('NaN')
})

test('sparkline: no NaN when all speeds equal (zero normalisation)', () => {
  const { container } = wrap({ ...base, state: 'downloading' }, [500, 500, 500])
  const polyline = container.querySelector('polyline')!
  expect(polyline.getAttribute('points')).not.toContain('NaN')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest TorrentRow --no-coverage
```

Expected: multiple FAIL (speedHistory prop missing, wrong labels, etc.)

- [ ] **Step 3: Update STATE_LABELS and isPaused in TorrentRow.tsx**

Replace the `STATE_LABELS` constant and `isPaused` line:

```ts
const STATE_LABELS: Record<string, string> = {
  downloading: 'In download',
  uploading: 'In seeding',
  stalledDL: 'In attesa',
  stalledUP: 'In seeding',
  pausedDL: 'In pausa',
  pausedUP: 'In pausa',
  error: 'Errore',
  checkingDL: 'Verifica',
  queuedDL: 'In coda',
  queuedUP: 'In coda',
  metaDL: 'Metadati',
  forcedDL: 'In download',
  forcedUP: 'In seeding',
}
```

And update `isPaused`:

```ts
const isPaused = torrent.state === 'pausedDL' || torrent.state === 'pausedUP'
```

- [ ] **Step 4: Fix title — remove truncate/max-w-xs, add overflow-wrap**

Change line 41 from:
```tsx
<p className="font-medium truncate max-w-xs">{torrent.name}</p>
```
to:
```tsx
<p className="font-medium overflow-wrap-break-word">{torrent.name}</p>
```

Note: `overflow-wrap-break-word` is the Tailwind v4 utility. Verify it applies correctly by checking the rendered element in browser; if not, use the `[overflow-wrap:break-word]` arbitrary value as fallback.

- [ ] **Step 5: Run tests to verify Task 1 work passes**

```bash
npx jest TorrentRow --no-coverage
```

Expected: label, isPaused, and title tests PASS; sparkline tests FAIL (component not yet added)

- [ ] **Step 6: Commit Task 1 work**

```bash
git add components/TorrentRow.tsx __tests__/components/TorrentRow.test.tsx
git commit -m "feat: update torrent state labels, isPaused fix, full title display"
```

---

## Task 2: SpeedSparkline component

**Files:**
- Modify: `components/TorrentRow.tsx`

The `SpeedSparkline` component lives in the same file as `TorrentRow`, defined above it.

- [ ] **Step 1: Add SpeedSparkline to TorrentRow.tsx**

Add this function above the `TorrentRow` export (after `formatEta`):

```tsx
const ACTIVE_STATES = new Set(['downloading', 'uploading', 'stalledUP', 'forcedDL', 'forcedUP'])

function SpeedSparkline({ speeds, state }: { speeds: number[]; state: string }) {
  const W = 80
  const H = 24
  const color = ACTIVE_STATES.has(state) ? '#a855f7' : '#6b7280'

  const pts: [number, number][] = speeds.length < 2
    ? [[0, H], [W, H]] // flat line at bottom
    : (() => {
        const min = Math.min(...speeds)
        const max = Math.max(...speeds)
        return speeds.map((v, i) => {
          const x = (i / (speeds.length - 1)) * W
          const y = max === min ? H : H - ((v - min) / (max - min)) * (H - 2)
          return [x, y] as [number, number]
        })
      })()

  const linePoints = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const areaPoints = [
    ...pts.map(([x, y]) => `${x},${y}`),
    [W, H] as [number, number],
    [0, H] as [number, number],
  ].map(([x, y]) => `${x},${y}`).join(' ')

  return (
    <svg width={W} height={H} className="shrink-0">
      <polygon points={areaPoints} fill={color} fillOpacity={0.2} stroke="none" />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
```

- [ ] **Step 2: Add speedHistory prop and render sparkline in TorrentRow**

Update the `TorrentRow` function signature and JSX.

Change the props interface from:
```tsx
export function TorrentRow({
  torrent,
  onDelete,
  onTogglePause,
}: {
  torrent: Torrent
  onDelete: (hash: string, deleteFiles: boolean) => void
  onTogglePause: (hash: string, paused: boolean) => void
})
```
to:
```tsx
export function TorrentRow({
  torrent,
  onDelete,
  onTogglePause,
  speedHistory = [],
}: {
  torrent: Torrent
  onDelete: (hash: string, deleteFiles: boolean) => void
  onTogglePause: (hash: string, paused: boolean) => void
  speedHistory?: number[]
})
```

Then inside the JSX, update the first `<td>` to include the sparkline next to the progress info:

```tsx
<td className="py-3 pr-4">
  <p className="font-medium overflow-wrap-break-word">{torrent.name}</p>
  <div className="flex items-center gap-3 mt-1">
    <div className="flex items-center gap-2">
      <Progress value={pct} className="h-1.5 w-40" />
      <span className="text-xs text-gray-400">{pct}%</span>
    </div>
    <SpeedSparkline speeds={speedHistory} state={torrent.state} />
  </div>
  <p className="text-xs text-gray-500 mt-1">{formatSpeed(torrent.dlspeed)} · ETA {formatEta(torrent.eta)}</p>
</td>
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
npx jest TorrentRow --no-coverage
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add components/TorrentRow.tsx __tests__/components/TorrentRow.test.tsx
git commit -m "feat: add SpeedSparkline SVG component to TorrentRow"
```

---

## Task 3: Speed history accumulation in downloads/page.tsx

**Files:**
- Modify: `app/downloads/page.tsx`

- [ ] **Step 1: Add useRef import and speedHistoryRef**

Change the import line from:
```tsx
import { useEffect, useState } from 'react'
```
to:
```tsx
import { useEffect, useRef, useState } from 'react'
```

Then add the ref inside `DownloadsPage`, after the `useState` lines:
```tsx
const speedHistoryRef = useRef<Map<string, number[]>>(new Map())
```

- [ ] **Step 2: Accumulate history on each SSE message**

Update the `es.onmessage` handler. Change from:
```tsx
es.onmessage = e => {
  const data = JSON.parse(e.data)
  if (Array.isArray(data)) setTorrents(data)
  else setError('qBittorrent non raggiungibile')
}
```
to:
```tsx
es.onmessage = e => {
  const data = JSON.parse(e.data)
  if (Array.isArray(data)) {
    data.forEach((t: { hash: string; dlspeed: number }) => {
      const history = speedHistoryRef.current.get(t.hash) ?? []
      history.push(t.dlspeed)
      if (history.length > 30) history.shift()
      speedHistoryRef.current.set(t.hash, history)
    })
    setTorrents(data)
  } else {
    setError('qBittorrent non raggiungibile')
  }
}
```

- [ ] **Step 3: Clean up history on torrent delete**

Update `deleteTorrent` to remove the hash from the ref:
```tsx
const deleteTorrent = async (hash: string, deleteFiles: boolean) => {
  await fetch(`/api/torrents/${hash}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deleteFiles }),
  })
  speedHistoryRef.current.delete(hash)
}
```

- [ ] **Step 4: Pass speedHistory prop to TorrentRow**

Change the TorrentRow render call from:
```tsx
<TorrentRow key={t.hash} torrent={t} onDelete={deleteTorrent} onTogglePause={togglePause} />
```
to:
```tsx
<TorrentRow
  key={t.hash}
  torrent={t}
  onDelete={deleteTorrent}
  onTogglePause={togglePause}
  speedHistory={speedHistoryRef.current.get(t.hash) ?? []}
/>
```

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add app/downloads/page.tsx
git commit -m "feat: accumulate per-torrent speed history for sparkline"
```
