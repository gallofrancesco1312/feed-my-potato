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

export interface AppConfig {
  radarr: ServiceConfig
  sonarr: ServiceConfig
  prowlarr: ServiceConfig
  qbittorrent: QBittorrentConfig
}

export const defaultConfig: AppConfig = {
  radarr: { url: 'http://localhost:7878', apiKey: '' },
  sonarr: { url: 'http://localhost:8989', apiKey: '' },
  prowlarr: { url: 'http://localhost:9696', apiKey: '' },
  qbittorrent: { url: 'http://localhost:8080', username: 'admin', password: '' },
}

const CONFIG_PATH = process.env.CONFIG_PATH ?? './config.json'

export async function readConfig(filePath = CONFIG_PATH): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      ...defaultConfig,
      ...parsed,
      radarr: { ...defaultConfig.radarr, ...(parsed.radarr ?? {}) },
      sonarr: { ...defaultConfig.sonarr, ...(parsed.sonarr ?? {}) },
      prowlarr: { ...defaultConfig.prowlarr, ...(parsed.prowlarr ?? {}) },
      qbittorrent: { ...defaultConfig.qbittorrent, ...(parsed.qbittorrent ?? {}) },
    }
  } catch {
    return { ...defaultConfig }
  }
}

export async function writeConfig(config: AppConfig, filePath = CONFIG_PATH): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
}
