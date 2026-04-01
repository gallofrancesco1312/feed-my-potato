// __tests__/api/arr-client.test.ts
import { arrFetch, arrTestConnection, ArrConfigError } from '@/lib/arr-client'
import { readConfig } from '@/lib/config'

jest.mock('@/lib/config')
global.fetch = jest.fn()

const mockReadConfig = readConfig as jest.MockedFunction<typeof readConfig>

afterEach(() => jest.resetAllMocks())

const baseConfig = {
  radarr: { url: 'http://radarr:7878', apiKey: 'radarr-key' },
  sonarr: { url: 'http://sonarr:8989', apiKey: 'sonarr-key' },
  prowlarr: { url: 'http://prowlarr:9696', apiKey: 'prowlarr-key' },
  qbittorrent: { url: 'http://qbit:8080', username: 'admin', password: 'pass' },
}

test('arrFetch calls Radarr with correct URL and X-Api-Key header', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 200,
    text: async () => JSON.stringify([{ id: 1, title: 'Inception' }]),
  })

  const result = await arrFetch('radarr', '/movie')

  expect(fetch).toHaveBeenCalledWith(
    'http://radarr:7878/api/v3/movie',
    expect.objectContaining({
      headers: expect.objectContaining({ 'X-Api-Key': 'radarr-key' }),
    }),
  )
  expect(result.data).toEqual([{ id: 1, title: 'Inception' }])
  expect(result.status).toBe(200)
})

test('arrFetch uses v1 API for Prowlarr', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 200,
    text: async () => JSON.stringify([]),
  })

  await arrFetch('prowlarr', '/indexer')

  expect(fetch).toHaveBeenCalledWith(
    'http://prowlarr:9696/api/v1/indexer',
    expect.anything(),
  )
})

test('arrFetch uses v3 API for Sonarr', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 200,
    text: async () => JSON.stringify([]),
  })

  await arrFetch('sonarr', '/series')

  expect(fetch).toHaveBeenCalledWith(
    'http://sonarr:8989/api/v3/series',
    expect.anything(),
  )
})

test('arrFetch throws ArrConfigError when apiKey missing', async () => {
  mockReadConfig.mockResolvedValue({
    ...baseConfig,
    radarr: { url: 'http://radarr:7878', apiKey: '' },
  })

  await expect(arrFetch('radarr', '/movie')).rejects.toThrow(ArrConfigError)
})

test('arrFetch throws ArrConfigError when url missing', async () => {
  mockReadConfig.mockResolvedValue({
    ...baseConfig,
    sonarr: { url: '', apiKey: 'key' },
  })

  await expect(arrFetch('sonarr', '/series')).rejects.toThrow(ArrConfigError)
})

test('arrFetch handles empty response body (204)', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 204,
    text: async () => '',
  })

  const result = await arrFetch('radarr', '/movie/1')
  expect(result.data).toBeNull()
  expect(result.status).toBe(204)
})

test('arrFetch forwards POST body and headers', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 201,
    text: async () => JSON.stringify({ id: 42 }),
  })

  const body = JSON.stringify({ tmdbId: 27205, title: 'Inception' })
  await arrFetch('radarr', '/movie', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })

  expect(fetch).toHaveBeenCalledWith(
    'http://radarr:7878/api/v3/movie',
    expect.objectContaining({
      method: 'POST',
      body,
      headers: expect.objectContaining({
        'X-Api-Key': 'radarr-key',
        'Content-Type': 'application/json',
      }),
    }),
  )
})

test('arrTestConnection returns true on 200', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 200,
    text: async () => JSON.stringify([]),
  })

  expect(await arrTestConnection('radarr')).toBe(true)
})

test('arrTestConnection returns false on network error', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'))

  expect(await arrTestConnection('radarr')).toBe(false)
})

test('arrTestConnection returns false on non-200', async () => {
  mockReadConfig.mockResolvedValue(baseConfig)
  ;(fetch as jest.Mock).mockResolvedValue({
    status: 401,
    text: async () => JSON.stringify({ error: 'Unauthorized' }),
  })

  expect(await arrTestConnection('sonarr')).toBe(false)
})
