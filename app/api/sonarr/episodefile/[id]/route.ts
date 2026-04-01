import { arrProxy } from '@/lib/arr-proxy'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return arrProxy('sonarr', `/episodefile/${id}`, { method: 'DELETE' })
}
