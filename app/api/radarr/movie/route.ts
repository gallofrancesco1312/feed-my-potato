import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('radarr', '/movie')
}

export async function POST(req: Request) {
  const body = await req.text()
  return arrProxy('radarr', '/movie', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}
