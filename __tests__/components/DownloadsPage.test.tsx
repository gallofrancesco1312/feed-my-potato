import { render, screen, waitFor } from '@testing-library/react'
import DownloadsPage from '@/app/downloads/page'

global.fetch = jest.fn()

beforeEach(() => {
  ;(global as any).EventSource = jest.fn(() => ({
    onmessage: null,
    onerror: null,
    close: jest.fn(),
  }))
  ;(fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/radarr/queue')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ records: [{ downloadId: 'abc123', title: 'Movie' }] }),
      })
    }
    if (url.includes('/api/sonarr/queue')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ records: [] }),
      })
    }
    return Promise.resolve({ ok: true, json: async () => ({}) })
  })
})

afterEach(() => jest.resetAllMocks())

test('renders downloads heading', async () => {
  render(<DownloadsPage />)
  expect(screen.getByText('Download')).toBeInTheDocument()
})

test('shows no downloads message when empty', async () => {
  render(<DownloadsPage />)
  await waitFor(() => {
    expect(screen.getByText('Nessun download attivo.')).toBeInTheDocument()
  })
})
