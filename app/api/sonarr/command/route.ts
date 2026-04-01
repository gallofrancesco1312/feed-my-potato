import { arrProxy } from '@/lib/arr-proxy'

export async function POST(req: Request) {
  const body = await req.text()
  return arrProxy('sonarr', '/command', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}
