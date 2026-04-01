import { arrProxy } from '@/lib/arr-proxy'

export async function POST() {
  return arrProxy('prowlarr', '/command', {
    method: 'POST',
    body: JSON.stringify({ name: 'AppIndexerSync' }),
    headers: { 'Content-Type': 'application/json' },
  })
}
