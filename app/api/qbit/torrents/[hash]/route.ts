import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'
import { QBittorrentClient } from '@/lib/qbittorrent'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params
    const { deleteFiles } = await req.json().catch(() => ({ deleteFiles: false }))
    const cfg = await readConfig()
    const client = new QBittorrentClient(
      cfg.qbittorrent.url,
      cfg.qbittorrent.username,
      cfg.qbittorrent.password,
    )
    await client.deleteTorrent(hash, !!deleteFiles)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Servizio non raggiungibile', service: 'qbittorrent', detail: String(err) },
      { status: 503 },
    )
  }
}
