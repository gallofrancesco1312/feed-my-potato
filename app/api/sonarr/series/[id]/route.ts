import { arrProxy } from '@/lib/arr-proxy'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return arrProxy('sonarr', `/series/${id}`)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.text()
  return arrProxy('sonarr', `/series/${id}`, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const deleteFiles = searchParams.get('deleteFiles') === 'true'
  return arrProxy('sonarr', `/series/${id}?deleteFiles=${deleteFiles}`, { method: 'DELETE' })
}
