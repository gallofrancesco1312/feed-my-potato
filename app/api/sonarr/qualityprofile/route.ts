import { arrProxy } from '@/lib/arr-proxy'

export async function GET() {
  return arrProxy('sonarr', '/qualityprofile')
}
