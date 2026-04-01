import { arrProxy } from '@/lib/arr-proxy'

export async function GET(req: Request) {
  const { search } = new URL(req.url)
  return arrProxy('radarr', `/calendar${search}`)
}
