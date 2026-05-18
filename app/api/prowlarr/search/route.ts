import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('query') ?? ''
  const type = searchParams.get('type') ?? 'search'
  return arrProxy('prowlarr', `/search?query=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`)
}
