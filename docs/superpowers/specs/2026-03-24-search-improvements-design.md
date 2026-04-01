# Design: Search Improvements

**Date:** 2026-03-24
**Status:** Approved

---

## Features

### 1. Recent Searches (chips)

Show the last 8 unique searches as clickable chips below the search input. Clicking a chip populates the query and triggers search. Each chip has an X to remove it individually.

**Storage:** `localStorage` key `fmp_recent_searches`, JSON array of strings, max 8, deduplicated (newest first).

**Behavior:**
- **Initial load:** Read `localStorage` only inside a `useEffect` with an empty dependency array. Initialize `recentSearches` state as `[]`. This avoids hydration mismatches because the server and the initial client render both produce an empty list, and localStorage is only accessed in the browser.
- On successful search (non-empty query): prepend to list, deduplicate, trim to 8, persist to localStorage
- Chips are rendered only when the list is non-empty
- Click chip → `setQuery(term)` (updates the input) + `search(term)` (executes immediately)
- Click X → remove that entry from the list

**`search` function signature:** `search` accepts an optional `term?: string` parameter. When provided, it uses `term` as the query; when absent, it uses the `query` state. This is necessary because React state updates are asynchronous — calling `setQuery(term)` followed immediately by `search()` would still read the stale `query` value.

**Scope:** All logic in `app/search/page.tsx`. No new files, no API changes.

---

### 2. Torrent Name Not Truncated

**Problem:** Long torrent titles get compressed or overflow because table column widths are fixed (`w-24`, `w-20`, `w-28`) and the title cell has no word-break rule.

**Fix:** Add `overflow-wrap-break-word min-w-0` to the title `<td>` in `components/SearchResults.tsx`.

Note: This project uses **Tailwind v4**, which removed the old `break-words` alias. The correct v4 utility is `overflow-wrap-break-word`. The `min-w-0` is also required — without it, `overflow-wrap-break-word` has no effect on table cells that are not width-constrained.

---

## Files Changed

| File | Change |
|---|---|
| `app/search/page.tsx` | Add localStorage recent searches logic + chips UI; update `search` to accept optional `term` param |
| `components/SearchResults.tsx` | Add `overflow-wrap-break-word min-w-0` to title `<td>` |
