// lib/config.ts
import fs from 'fs/promises'

export interface ServiceConfig {
  url: string
  apiKey: string
}

export interface QBittorrentConfig {
  url: string
  username: string
  password: string
}

export interface JellyfinConfig {
  url: string
  apiKey: string
}

export interface AppConfig {
  radarr: ServiceConfig
  sonarr: ServiceConfig
  prowlarr: ServiceConfig
  bazarr: ServiceConfig
  qbittorrent: QBittorrentConfig
  jellyfin: JellyfinConfig
}

export const defaultConfig: AppConfig = {
  radarr: { url: 'http://localhost:7878', apiKey: '' },
  sonarr: { url: 'http://localhost:8989', apiKey: '' },
  prowlarr: { url: 'http://localhost:9696', apiKey: '' },
  bazarr: { url: 'http://feed-my-potato-bazarr:6767', apiKey: '' },
  qbittorrent: { url: 'http://localhost:8080', username: 'admin', password: '' },
  jellyfin: { url: 'http://feed-my-potato-jellyfin:8096', apiKey: '' },
}

const CONFIG_PATH = process.env.CONFIG_PATH ?? './config.json'

// Paths where service config.xml files are mounted (read-only)
const SERVICE_CONFIG_XML: Record<string, string> = {
  sonarr: '/service-config/sonarr/config.xml',
  radarr: '/service-config/radarr/config.xml',
  prowlarr: '/service-config/prowlarr/config.xml',
}

/** Extract <ApiKey>…</ApiKey> from an *arr config.xml */
async function readApiKeyFromXml(xmlPath: string): Promise<string> {
  try {
    const xml = await fs.readFile(xmlPath, 'utf-8')
    const match = xml.match(/<ApiKey>([^<]+)<\/ApiKey>/)
    return match?.[1] ?? ''
  } catch {
    return ''
  }
}

const BAZARR_CONFIG_YAML = '/service-config/bazarr/config/config.yaml'

/** Extract auth.apikey from Bazarr config.yaml */
async function readBazarrApiKey(): Promise<string> {
  try {
    const yaml = await fs.readFile(BAZARR_CONFIG_YAML, 'utf-8')
    const match = yaml.match(/^\s*apikey:\s*(.+)$/m)
    return match?.[1]?.trim() ?? ''
  } catch {
    return ''
  }
}

export async function readConfig(filePath = CONFIG_PATH): Promise<AppConfig> {
  let parsed: Record<string, unknown> = {}
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    parsed = JSON.parse(raw)
  } catch {
    // no config.json — will use defaults + auto-discovered keys
  }

  const config: AppConfig = {
    ...defaultConfig,
    ...parsed,
    radarr: { ...defaultConfig.radarr, ...((parsed.radarr as Record<string, unknown>) ?? {}) } as ServiceConfig,
    sonarr: { ...defaultConfig.sonarr, ...((parsed.sonarr as Record<string, unknown>) ?? {}) } as ServiceConfig,
    prowlarr: { ...defaultConfig.prowlarr, ...((parsed.prowlarr as Record<string, unknown>) ?? {}) } as ServiceConfig,
    bazarr: { ...defaultConfig.bazarr, ...((parsed.bazarr as Record<string, unknown>) ?? {}) } as ServiceConfig,
    qbittorrent: { ...defaultConfig.qbittorrent, ...((parsed.qbittorrent as Record<string, unknown>) ?? {}) } as QBittorrentConfig,
    jellyfin: { ...defaultConfig.jellyfin, ...((parsed.jellyfin as Record<string, unknown>) ?? {}) } as JellyfinConfig,
  }

  // Auto-discover API keys from mounted config.xml files (overrides config.json)
  for (const service of ['sonarr', 'radarr', 'prowlarr'] as const) {
    const key = await readApiKeyFromXml(SERVICE_CONFIG_XML[service])
    if (key) config[service].apiKey = key
  }

  // Auto-discover Bazarr API key from its YAML config
  const bazarrKey = await readBazarrApiKey()
  if (bazarrKey) config.bazarr.apiKey = bazarrKey

  return config
}

export async function writeConfig(config: AppConfig, filePath = CONFIG_PATH): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
}
