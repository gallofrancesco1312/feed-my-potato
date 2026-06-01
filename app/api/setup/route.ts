import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'
import { arrFetch } from '@/lib/arr-client'

const ROOT_FOLDERS: Record<'sonarr' | 'radarr', string> = {
  sonarr: '/data/series',
  radarr: '/data/movies',
}

/**
 * Ensure Sonarr and Radarr have:
 * 1. A root folder configured
 * 2. qBittorrent as download client
 * 3. Remote path mapping (/downloads/ → /data/downloads/)
 * Idempotent — skips anything already configured.
 */
export async function POST() {
  const cfg = await readConfig()
  const results: Record<string, Record<string, string>> = {}

  const qbitHost = 'localhost'
  const qbitPort = 8080

  for (const service of ['sonarr', 'radarr'] as const) {
    results[service] = {}
    try {
      // --- Root folder ---
      const { data: folders } = await arrFetch(service, '/rootfolder')
      const folderList = Array.isArray(folders) ? folders : []
      if (folderList.length === 0) {
        const { status } = await arrFetch(service, '/rootfolder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: ROOT_FOLDERS[service] }),
        })
        results[service].rootFolder = status === 201 ? 'configured' : `status ${status}`
      } else {
        results[service].rootFolder = 'already configured'
      }

      // --- Download client ---
      const { data: existing } = await arrFetch(service, '/downloadclient')
      const clients = Array.isArray(existing) ? existing : []
      const hasQbit = clients.some(
        (c: { implementation?: string }) => c.implementation === 'QBittorrent',
      )

      if (hasQbit) {
        results[service].downloadClient = 'already configured'
      } else {
        const category = service === 'sonarr' ? 'tv-sonarr' : 'radarr'
        const { status } = await arrFetch(service, '/downloadclient', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enable: true,
            name: 'qBittorrent',
            implementation: 'QBittorrent',
            protocol: 'torrent',
            configContract: 'QBittorrentSettings',
            priority: 1,
            removeCompletedDownloads: true,
            removeFailedDownloads: true,
            fields: [
              { name: 'host', value: qbitHost },
              { name: 'port', value: qbitPort },
              { name: 'useSsl', value: false },
              { name: 'urlBase', value: '' },
              { name: 'username', value: cfg.qbittorrent.username },
              { name: 'password', value: cfg.qbittorrent.password },
              { name: service === 'sonarr' ? 'tvCategory' : 'movieCategory', value: category },
              { name: 'initialState', value: 0 },
              { name: 'sequentialOrder', value: false },
              { name: 'firstAndLast', value: false },
            ],
            tags: [],
          }),
        })
        results[service].downloadClient = status === 201 ? 'configured' : `status ${status}`
      }

      // --- Remote path mapping (qBit sees /downloads/, Sonarr/Radarr see /data/downloads/) ---
      const { data: mappings } = await arrFetch(service, '/remotepathmapping')
      const mappingList = Array.isArray(mappings) ? mappings : []
      const hasMapping = mappingList.some(
        (m: { remotePath?: string }) => m.remotePath === '/downloads/',
      )

      if (hasMapping) {
        results[service].pathMapping = 'already configured'
      } else {
        const { status } = await arrFetch(service, '/remotepathmapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: qbitHost,
            remotePath: '/downloads/',
            localPath: '/data/downloads/',
          }),
        })
        results[service].pathMapping = status === 201 ? 'configured' : `status ${status}`
      }

    } catch (err) {
      results[service].error = err instanceof Error ? err.message : String(err)
    }
  }

  return NextResponse.json(results)
}
