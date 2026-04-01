import { NextResponse } from 'next/server'
import { arrFetch, ArrConfigError } from '@/lib/arr-client'
import { statfs } from 'fs/promises'

const MEDIA_PATH = '/media/plex'

export async function GET() {
  try {
    // Fetch Radarr diskspace for any extra entries, and query the filesystem directly
    const [diskRes, fsStats] = await Promise.all([
      arrFetch('radarr', '/diskspace').catch(() => ({ data: [], status: 200 })),
      statfs(MEDIA_PATH).catch(() => null),
    ])

    const disks = Array.isArray(diskRes.data) ? diskRes.data : []

    if (fsStats) {
      const totalSpace = fsStats.blocks * fsStats.bsize
      const freeSpace = fsStats.bavail * fsStats.bsize
      // Replace or add the media entry
      const idx = disks.findIndex((d: { path: string }) => d.path.startsWith(MEDIA_PATH))
      const entry = { path: MEDIA_PATH, label: 'Media', freeSpace, totalSpace }
      if (idx >= 0) disks[idx] = entry
      else disks.push(entry)
    }

    return NextResponse.json(disks)
  } catch (err) {
    if (err instanceof ArrConfigError) {
      return NextResponse.json({ error: 'Configurazione mancante', service: 'radarr' }, { status: 502 })
    }
    return NextResponse.json(
      { error: 'Servizio non raggiungibile', service: 'radarr', detail: String(err) },
      { status: 503 },
    )
  }
}
