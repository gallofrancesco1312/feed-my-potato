import { QBittorrentClient } from '@/lib/qbittorrent'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

function mockFetch(...responses: object[]) {
  for (const r of responses) {
    ;(fetch as jest.Mock).mockResolvedValueOnce(r)
  }
}

test('getTorrents returns list', async () => {
  mockFetch(
    { ok: true, text: async () => 'Ok' },         // login
    { ok: true, json: async () => [{ hash: 'abc', name: 'Movie', progress: 0.5 }] }, // list
  )
  const client = new QBittorrentClient('http://localhost:8080', 'admin', 'pass')
  const result = await client.getTorrents()
  expect(result[0].hash).toBe('abc')
})

test('addMagnet posts to qBit', async () => {
  mockFetch(
    { ok: true, text: async () => 'Ok' },   // login
    { ok: true, text: async () => 'Ok' },   // add
  )
  const client = new QBittorrentClient('http://localhost:8080', 'admin', 'pass')
  await expect(client.addMagnet('magnet:?xt=...')).resolves.not.toThrow()
})
