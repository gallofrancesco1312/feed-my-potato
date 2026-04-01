# Delete Files From Disk

## Summary

Add the ability to delete physical media files from disk when removing a movie or TV series from the library. The user chooses via a checkbox in the existing confirmation dialog.

## Requirements

- When deleting a movie or series, the confirmation dialog includes a checkbox: "Elimina anche i file dal disco"
- The checkbox is **checked by default**
- When checked, a red warning appears: "I file verranno eliminati permanentemente"
- The `deleteFiles` query parameter is forwarded to Radarr/Sonarr APIs
- Toast notification reflects whether files were also deleted

## Backend Changes

### `app/api/radarr/movie/[id]/route.ts`

Forward `deleteFiles` query parameter from the incoming request to the Radarr API call:

```
DELETE /api/radarr/movie/{id}?deleteFiles=true
  → DELETE {radarrUrl}/api/v3/movie/{id}?deleteFiles=true
```

### `app/api/sonarr/series/[id]/route.ts`

Same pattern for Sonarr:

```
DELETE /api/sonarr/series/{id}?deleteFiles=true
  → DELETE {sonarrUrl}/api/v3/series/{id}?deleteFiles=true
```

## Frontend Changes

### `app/movies/page.tsx`

- Add `deleteFiles` state (`useState(true)`)
- Add checkbox in the confirmation dialog
- Add conditional red warning text
- Pass `?deleteFiles={value}` in the DELETE fetch call
- Update toast message to indicate file deletion

### `app/series/page.tsx`

- Same changes as movies page

## Files to Modify

1. `app/api/radarr/movie/[id]/route.ts`
2. `app/api/sonarr/series/[id]/route.ts`
3. `app/movies/page.tsx`
4. `app/series/page.tsx`
