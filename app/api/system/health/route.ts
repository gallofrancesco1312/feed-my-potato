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
