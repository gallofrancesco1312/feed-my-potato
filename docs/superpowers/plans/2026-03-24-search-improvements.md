# Search Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent recent-searches chips to the search page and fix torrent name truncation in the results table.

**Architecture:** Recent searches are stored in `localStorage` under `fmp_recent_searches` and managed entirely in `app/search/page.tsx`. The `search` function gains an optional `term` parameter to allow chip-triggered searches without depending on stale React state. The name fix is a two-class change in `components/SearchResults.tsx`.

**Tech Stack:** Next.js 15 App Router, React, Tailwind v4, localStorage, Jest + Testing Library (jsdom)

**Spec:** `docs/superpowers/specs/2026-03-24-search-improvements-design.md`

---

## File Map

| File | Change |
|---|---|
| `components/SearchResults.tsx` | Add `overflow-wrap-break-word min-w-0` to the title `<td>` |
| `app/search/page.tsx` | Add `recentSearches` state + localStorage sync + chips UI; update `search(term?)` |
| `__tests__/components/SearchResults.test.tsx` | Add test for long title wrapping |
| `__tests__/components/SearchPage.test.tsx` | New test file for recent-searches behaviour |

---

## Task 1: Fix torrent name truncation in SearchResults

**Files:**
- Modify: `components/SearchResults.tsx:48`
- Modify: `__tests__/components/SearchResults.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/components/SearchResults.test.tsx`:

```tsx
test('title cell has overflow-wrap-break-word and min-w-0 classes', () => {
  render(<SearchResults results={results} onDownload={jest.fn()} />)
  const titleCell = screen.getByText(/The\.Matrix\.1080p\.mkv/, { exact: false }).closest('td')
  expect(titleCell?.className).toMatch(/overflow-wrap-break-word/)
  expect(titleCell?.className).toMatch(/min-w-0/)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/SearchResults.test.tsx --no-coverage
```

Expected: FAIL — `overflow-wrap-break-word` and `min-w-0` not in className.

- [ ] **Step 3: Apply the fix**

In `components/SearchResults.tsx`, change line 48:

```tsx
// Before
<td className="py-2 pr-4">

// After
<td className="py-2 pr-4 overflow-wrap-break-word min-w-0">
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/components/SearchResults.test.tsx --no-coverage
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/SearchResults.tsx __tests__/components/SearchResults.test.tsx
git commit -m "fix: prevent torrent title truncation in results table"
```

---

## Task 2: Add recent searches chips to the search page

**Files:**
- Modify: `app/search/page.tsx`
- Create: `__tests__/components/SearchPage.test.tsx`

### 2a — Update `search` to accept optional `term`

- [ ] **Step 1: Create test file with failing test for `search(term)`**

Create `__tests__/components/SearchPage.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SearchPage from '@/app/search/page'

// Mock fetch: config check + search results
beforeEach(() => {
  global.fetch = jest.fn((url: string) => {
    if (url === '/api/config') {
      return Promise.resolve({ json: () => Promise.resolve({ plexFolder: '/media', jackett: { apiKey: 'key' } }) })
    }
    if (String(url).startsWith('/api/search')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  }) as jest.Mock
  localStorage.clear()
})

afterEach(() => jest.restoreAllMocks())

test('typing and pressing Enter triggers a search', async () => {
  render(<SearchPage />)
  const input = screen.getByPlaceholderText(/cerca film/i)
  fireEvent.change(input, { target: { value: 'Avatar' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/search?q=Avatar')
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails (or passes — baseline)**

```bash
npx jest __tests__/components/SearchPage.test.tsx --no-coverage
```

Note the result. If it passes, proceed — this is the baseline before adding recent-searches behaviour.

### 2b — Add recent searches state and localStorage sync

- [ ] **Step 3: Write failing tests for recent-searches persistence**

Add to `__tests__/components/SearchPage.test.tsx`:

```tsx
test('saves search term to localStorage after search', async () => {
  render(<SearchPage />)
  const input = screen.getByPlaceholderText(/cerca film/i)
  fireEvent.change(input, { target: { value: 'Dune' } })
  fireEvent.click(screen.getByRole('button', { name: /cerca/i }))
  await waitFor(() => {
    const stored = JSON.parse(localStorage.getItem('fmp_recent_searches') ?? '[]')
    expect(stored).toContain('Dune')
  })
})

test('shows saved searches as chips on mount', async () => {
  localStorage.setItem('fmp_recent_searches', JSON.stringify(['Interstellar', 'Avatar']))
  render(<SearchPage />)
  await waitFor(() => {
    expect(screen.getByText('Interstellar')).toBeInTheDocument()
    expect(screen.getByText('Avatar')).toBeInTheDocument()
  })
})

test('clicking a chip triggers a search with that term', async () => {
  localStorage.setItem('fmp_recent_searches', JSON.stringify(['Matrix']))
  render(<SearchPage />)
  await waitFor(() => screen.getByText('Matrix'))
  fireEvent.click(screen.getByText('Matrix'))
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/search?q=Matrix')
    )
  })
})

test('clicking X on a chip removes it', async () => {
  localStorage.setItem('fmp_recent_searches', JSON.stringify(['Matrix', 'Dune']))
  render(<SearchPage />)
  await waitFor(() => screen.getByText('Matrix'))
  // Each chip has an × button; find the one next to 'Matrix'
  const chip = screen.getByText('Matrix').closest('[data-chip]')!
  fireEvent.click(chip.querySelector('button')!)
  expect(screen.queryByText('Matrix')).not.toBeInTheDocument()
  expect(screen.getByText('Dune')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npx jest __tests__/components/SearchPage.test.tsx --no-coverage
```

Expected: FAIL — chips and localStorage logic don't exist yet.

- [ ] **Step 5: Implement the feature in `app/search/page.tsx`**

Replace the full file content with:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SearchResults, TorrentResult } from '@/components/SearchResults'

const LS_KEY = 'fmp_recent_searches'
const MAX_RECENT = 8

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TorrentResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Load from localStorage only on the client to avoid hydration mismatch
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
      if (Array.isArray(stored)) setRecentSearches(stored)
    } catch { /* ignore corrupted data */ }
  }, [])

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then((cfg) => {
        if (!cfg.plexFolder || !cfg.jackett?.apiKey) {
          setError('Configura Jackett e la cartella Plex prima di cercare.')
        }
      })
  }, [])

  const saveRecent = (term: string) => {
    setRecentSearches(prev => {
      const next = [term, ...prev.filter(t => t !== term)].slice(0, MAX_RECENT)
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }

  const removeRecent = (term: string) => {
    setRecentSearches(prev => {
      const next = prev.filter(t => t !== term)
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }

  const search = async (term?: string) => {
    const q = (term ?? query).trim()
    if (!q) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Errore'); return }
    setResults(data)
    saveRecent(q)
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
        <Button onClick={() => search()} disabled={loading}>{loading ? 'Cercando...' : 'Cerca'}</Button>
      </div>

      {recentSearches.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {recentSearches.map(term => (
            <span
              key={term}
              data-chip="true"
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer"
            >
              <span onClick={() => { setQuery(term); search(term) }}>{term}</span>
              <button
                onClick={() => removeRecent(term)}
                className="ml-1 text-gray-500 hover:text-gray-200 leading-none"
                aria-label={`Rimuovi ${term}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-red-400 mt-3 text-sm">{error} — <a href="/settings" className="underline">Controlla le impostazioni</a></p>}
      <SearchResults results={results} onDownload={async (magnetUri) => {
        const res = await fetch('/api/torrents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ magnetUri }),
        })
        setToast(res.ok ? 'Torrent aggiunto! ✓' : "Errore nell'aggiunta.")
        setTimeout(() => setToast(''), 3000)
      }} />
    </div>
  )
}
```

- [ ] **Step 6: Run all component tests**

```bash
npx jest __tests__/components/ --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 7: Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add app/search/page.tsx __tests__/components/SearchPage.test.tsx
git commit -m "feat: add recent searches chips with localStorage persistence"
```

---

## Task 3: Push

- [ ] **Step 1: Push to remote**

```bash
git push
```
