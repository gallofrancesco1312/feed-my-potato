export interface StateConfig {
  label: string
  color: 'blue' | 'green' | 'yellow' | 'gray' | 'red'
}

const STATE_MAP: Record<string, StateConfig> = {
  // Download (blue)
  downloading:        { label: 'Scaricando',            color: 'blue' },
  forcedDL:           { label: 'Download forzato',      color: 'blue' },
  metaDL:             { label: 'Scaricando metadati',   color: 'blue' },

  // Waiting/Queued (yellow)
  stalledDL:          { label: 'In attesa (download)',   color: 'yellow' },
  queuedDL:           { label: 'In coda (download)',     color: 'yellow' },
  allocating:         { label: 'Allocazione spazio',     color: 'yellow' },

  // Seeding (green)
  uploading:          { label: 'In seeding',             color: 'green' },
  stalledUP:          { label: 'In seeding',             color: 'green' },
  forcedUP:           { label: 'Seeding forzato',        color: 'green' },
  queuedUP:           { label: 'In coda (seeding)',      color: 'green' },

  // Paused/Checking (gray)
  pausedDL:           { label: 'In pausa',               color: 'gray' },
  pausedUP:           { label: 'In pausa (completo)',    color: 'gray' },
  checkingDL:         { label: 'Verifica file',          color: 'gray' },
  checkingUP:         { label: 'Verifica file',          color: 'gray' },
  checkingResumeData: { label: 'Verifica ripresa',       color: 'gray' },
  moving:             { label: 'Spostamento file',       color: 'gray' },

  // Error (red)
  error:              { label: 'Errore',                 color: 'red' },
  missingFiles:       { label: 'File mancanti',          color: 'red' },
  unknown:            { label: 'Sconosciuto',            color: 'gray' },
}

export const BADGE_COLORS: Record<StateConfig['color'], string> = {
  blue:   'bg-blue-900/30 text-blue-400',
  green:  'bg-green-900/30 text-green-400',
  yellow: 'bg-yellow-900/30 text-yellow-400',
  gray:   'bg-gray-700/30 text-gray-400',
  red:    'bg-red-900/30 text-red-400',
}

export function getStateConfig(state: string): StateConfig {
  return STATE_MAP[state] ?? { label: state, color: 'gray' as const }
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const val = bytes / Math.pow(1024, i)
  return `${i === 0 ? val : val.toFixed(1)} ${units[i]}`
}

export function formatDate(unixTimestamp: number): string {
  if (!unixTimestamp) return ''
  return new Date(unixTimestamp * 1000).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function extractTrackerHost(url: string): string {
  if (!url) return ''
  try {
    const normalized = url.replace(/^udp:/, 'http:')
    return new URL(normalized).hostname
  } catch {
    return url
  }
}
