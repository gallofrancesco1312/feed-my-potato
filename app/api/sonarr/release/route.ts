import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('sonarr', `/release${search}`)
}

export async function POST(req: Request) {
  const body = await req.text()
  return arrProxy('sonarr', '/release', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}
