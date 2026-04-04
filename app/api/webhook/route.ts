import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config'

/**
 * Webhook called by Sonarr/Radarr on import.
 * Triggers a Jellyfin library scan so new media appears immediately.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const eventType = body.eventType ?? ''

  // Only trigger on successful imports (and allow Test for webhook validation)
  if (eventType !== 'Download' && eventType !== 'Test') {
    return NextResponse.json({ ok: true, skipped: eventType })
  }

  const cfg = await readConfig()
  if (!cfg.jellyfin.apiKey) {
    return NextResponse.json({ error: 'Jellyfin API key not configured' }, { status: 502 })
  }

  try {
    await fetch(`${cfg.jellyfin.url}/Library/Refresh`, {
      method: 'POST',
      headers: { 'X-Emby-Token': cfg.jellyfin.apiKey },
    })
    return NextResponse.json({ ok: true, event: eventType })
  } catch (err) {
    return NextResponse.json(
      { error: 'Jellyfin scan failed', detail: String(err) },
      { status: 503 },
    )
  }
}
