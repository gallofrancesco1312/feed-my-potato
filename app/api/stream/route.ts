import { readConfig } from '@/lib/config'
import { QBittorrentClient } from '@/lib/qbittorrent'

export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const cfg = await readConfig()
      const client = new QBittorrentClient(
        cfg.qbittorrent.url,
        cfg.qbittorrent.username,
        cfg.qbittorrent.password,
      )

      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      while (true) {
        try {
          const torrents = await client.getTorrents()
          send(torrents)
        } catch {
          send({ error: 'qBittorrent non raggiungibile' })
        }
        await new Promise(r => setTimeout(r, 2000))
      }
    },
    cancel() {},
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
