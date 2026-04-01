import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'
import { QBittorrentClient } from '@/lib/qbittorrent'

export async function POST(req: Request) {
  const { url, category } = await req.json()
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }
  try {
    const cfg = await readConfig()
    const client = new QBittorrentClient(
      cfg.qbittorrent.url,
      cfg.qbittorrent.username,
      cfg.qbittorrent.password,
    )
    await client.addTorrentUrl(url, category)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Download fallito', detail: String(err) },
      { status: 503 },
    )
  }
}
