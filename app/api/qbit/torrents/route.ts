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
    const all = await client.getTorrents()
    const torrents = all.filter(t => t.state !== 'missingFiles')
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
