import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('prowlarr', '/indexer')
}

export async function POST(req: Request) {
  const body = await req.text()
  return arrProxy('prowlarr', '/indexer', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function PUT(req: Request) {
  const body = await req.text()
  return arrProxy('prowlarr', '/indexer', {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function DELETE(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('prowlarr', `/indexer${search}`, { method: 'DELETE' })
}
