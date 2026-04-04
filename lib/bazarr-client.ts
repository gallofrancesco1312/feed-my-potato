import { readConfig } from './config'

export interface BazarrSubtitle {
  name: string
  code2: string
  code3: string
  path: string | null
  forced: boolean
  hi: boolean
}

export interface BazarrEpisode {
  sonarrSeriesId: number
  sonarrEpisodeId: number
  season: number
  episode: number
  title: string
  subtitles: BazarrSubtitle[]
  missing_subtitles: BazarrSubtitle[]
}

export interface BazarrMovie {
  radarrId: number
  title: string
  subtitles: BazarrSubtitle[]
  missing_subtitles: BazarrSubtitle[]
}

async function bazarrFetch(path: string): Promise<unknown> {
  const cfg = await readConfig()
  if (!cfg.bazarr.url || !cfg.bazarr.apiKey) return null

  const res = await fetch(`${cfg.bazarr.url}/api${path}`, {
    headers: { 'X-API-KEY': cfg.bazarr.apiKey },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.data ?? json
}

export async function getBazarrEpisodes(seriesId: number): Promise<BazarrEpisode[]> {
  try {
    const data = await bazarrFetch(`/episodes?seriesid%5B%5D=${seriesId}`)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function getBazarrMovies(): Promise<BazarrMovie[]> {
  try {
    const data = await bazarrFetch('/movies')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function testBazarrConnection(): Promise<boolean> {
  try {
    const data = await bazarrFetch('/system/status')
    return data !== null
  } catch {
    return false
  }
}
