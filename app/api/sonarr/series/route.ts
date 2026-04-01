import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('sonarr', '/series')
}

export async function POST(req: Request) {
  const body = await req.text()
  return arrProxy('sonarr', '/series', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}
