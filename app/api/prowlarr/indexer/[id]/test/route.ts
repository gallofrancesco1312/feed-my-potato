import { arrFetch, ArrConfigError } from '@/lib/arr-client'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    // Prowlarr requires the full indexer object as POST body to /indexer/test
    const { data: indexer, status } = await arrFetch('prowlarr', `/indexer/${id}`)
    if (status !== 200) return NextResponse.json({ error: 'Indexer non trovato' }, { status })

    const { status: testStatus } = await arrFetch('prowlarr', '/indexer/test', {
      method: 'POST',
      body: JSON.stringify(indexer),
      headers: { 'Content-Type': 'application/json' },
    })
    return new NextResponse(null, { status: testStatus })
  } catch (err) {
    if (err instanceof ArrConfigError) {
      return NextResponse.json({ error: 'Configurazione mancante', service: 'prowlarr' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Servizio non raggiungibile', detail: String(err) }, { status: 503 })
  }
}
