import { arrProxy } from '@/lib/arr-proxy'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return arrProxy('prowlarr', `/indexer/${id}/test`, { method: 'POST' })
}
