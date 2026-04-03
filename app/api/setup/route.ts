import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'
import { arrFetch } from '@/lib/arr-client'

/**
 * Ensure qBittorrent is configured as download client in both Sonarr and Radarr.
 * Idempotent — skips if already configured.
 */
export async function POST() {
  const cfg = await readConfig()
  const results: Record<string, string> = {}

  // All services share gluetun's network, so qBittorrent is at localhost
  const qbitHost = 'localhost'
  const qbitPort = 8080

  for (const service of ['sonarr', 'radarr'] as const) {
    try {
      // Check if a qBittorrent download client already exists
      const { data: existing } = await arrFetch(service, '/downloadclient')
      const clients = Array.isArray(existing) ? existing : []
      const hasQbit = clients.some(
        (c: { implementation?: string }) => c.implementation === 'QBittorrent',
      )

      if (hasQbit) {
        results[service] = 'already configured'
        continue
      }

      const category = service === 'sonarr' ? 'tv-sonarr' : 'radarr'

      const payload = {
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
      }

      const { status } = await arrFetch(service, '/downloadclient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      results[service] = status === 201 ? 'configured' : `unexpected status ${status}`
    } catch (err) {
      results[service] = `error: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  return NextResponse.json(results)
}
