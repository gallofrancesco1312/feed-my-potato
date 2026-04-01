// app/api/config/route.ts
import { NextResponse } from 'next/server'
import { readConfig, writeConfig, AppConfig } from '@/lib/config'

export async function GET() {
  try {
    const config = await readConfig()
    return NextResponse.json(config)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('radarr' in body) ||
    !('sonarr' in body) ||
    !('prowlarr' in body) ||
    !('qbittorrent' in body)
  ) {
    return NextResponse.json({ error: 'Invalid config shape' }, { status: 400 })
  }

  try {
    await writeConfig(body as AppConfig)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
