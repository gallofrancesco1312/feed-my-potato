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
