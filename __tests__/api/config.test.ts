// __tests__/api/config.test.ts
import { readConfig, writeConfig, defaultConfig } from '@/lib/config'
import fs from 'fs'
import path from 'path'
import os from 'os'

const tmpFile = path.join(os.tmpdir(), `config-test-${Date.now()}.json`)

afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
})

test('readConfig returns defaultConfig when file missing', async () => {
  const result = await readConfig(tmpFile)
  expect(result).toEqual(defaultConfig)
})

test('defaultConfig has correct service URLs', () => {
  expect(defaultConfig.radarr.url).toBe('http://localhost:7878')
  expect(defaultConfig.sonarr.url).toBe('http://localhost:8989')
  expect(defaultConfig.prowlarr.url).toBe('http://localhost:9696')
  expect(defaultConfig.qbittorrent.url).toBe('http://localhost:8080')
})

test('writeConfig writes then readConfig reads back', async () => {
  const cfg = {
    ...defaultConfig,
    radarr: { url: 'http://radarr:7878', apiKey: 'abc123' },
  }
  await writeConfig(cfg, tmpFile)
  const result = await readConfig(tmpFile)
  expect(result.radarr.url).toBe('http://radarr:7878')
  expect(result.radarr.apiKey).toBe('abc123')
})

test('readConfig deep merges nested objects with defaults', async () => {
  const partial = JSON.stringify({ radarr: { url: 'http://remote:7878' } })
  await fs.promises.writeFile(tmpFile, partial)
  const result = await readConfig(tmpFile)
  expect(result.radarr.url).toBe('http://remote:7878')
  expect(result.radarr.apiKey).toBe(defaultConfig.radarr.apiKey)
})

test('readConfig preserves all service sections', async () => {
  const partial = JSON.stringify({ sonarr: { apiKey: 'test-key' } })
  await fs.promises.writeFile(tmpFile, partial)
  const result = await readConfig(tmpFile)
  expect(result.sonarr.apiKey).toBe('test-key')
  expect(result.sonarr.url).toBe(defaultConfig.sonarr.url)
  expect(result.radarr).toEqual(defaultConfig.radarr)
  expect(result.prowlarr).toEqual(defaultConfig.prowlarr)
  expect(result.qbittorrent).toEqual(defaultConfig.qbittorrent)
})
