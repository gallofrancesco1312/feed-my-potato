// lib/arr-client.ts
import { readConfig } from './config'

export type ArrService = 'radarr' | 'sonarr' | 'prowlarr'

export class ArrConfigError extends Error {
  constructor(public service: string) {
    super(`Configurazione mancante per ${service}`)
    this.name = 'ArrConfigError'
  }
}

export async function arrFetch(
  service: ArrService,
  path: string,
  init?: RequestInit,
): Promise<{ data: unknown; status: number }> {
  const cfg = await readConfig()
  const svc = cfg[service]
  if (!svc.url || !svc.apiKey) throw new ArrConfigError(service)

  const apiVersion = service === 'prowlarr' ? 'v1' : 'v3'
  const timeout = path.includes('lookup') || path.includes('release') ? 30000 : 15000

  const res = await fetch(`${svc.url}/api/${apiVersion}${path}`, {
    ...init,
    headers: {
      'X-Api-Key': svc.apiKey,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(timeout),
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  return { data, status: res.status }
}

export async function arrTestConnection(service: ArrService): Promise<boolean> {
  try {
    const { status } = await arrFetch(service, '/health')
    return status === 200
  } catch {
    return false
  }
}
