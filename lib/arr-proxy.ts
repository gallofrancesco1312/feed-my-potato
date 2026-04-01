// lib/arr-proxy.ts
import { NextResponse } from 'next/server'
import { arrFetch, ArrConfigError, type ArrService } from './arr-client'

export async function arrProxy(
  service: ArrService,
  path: string,
  init?: RequestInit,
): Promise<NextResponse> {
  try {
    const { data, status } = await arrFetch(service, path, init)
    if (data === null) return new NextResponse(null, { status })
    return NextResponse.json(data, { status })
  } catch (err) {
    if (err instanceof ArrConfigError) {
      return NextResponse.json(
        { error: 'Configurazione mancante', service },
        { status: 502 },
      )
    }
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Timeout', service },
        { status: 504 },
      )
    }
    return NextResponse.json(
      { error: 'Servizio non raggiungibile', service, detail: String(err) },
      { status: 503 },
    )
  }
}
