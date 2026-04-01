import { render, screen, waitFor } from '@testing-library/react'
import SystemPage from '@/app/system/page'

global.fetch = jest.fn()

beforeEach(() => {
  ;(fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/config')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          radarr: { url: 'http://radarr:7878', apiKey: 'key1' },
          sonarr: { url: 'http://sonarr:8989', apiKey: 'key2' },
          prowlarr: { url: 'http://prowlarr:9696', apiKey: 'key3' },
          qbittorrent: { url: 'http://qbit:8080', username: 'admin', password: 'pass' },
        }),
      })
    }
    if (url.includes('/api/system/health')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          radarr: true,
          sonarr: true,
          prowlarr: true,
          qbittorrent: true,
        }),
      })
    }
    return Promise.resolve({ ok: true, json: async () => ({}) })
  })
})

afterEach(() => jest.resetAllMocks())

test('renders system heading', async () => {
  render(<SystemPage />)
  await waitFor(() => {
    expect(screen.getByText('Sistema')).toBeInTheDocument()
  })
})

test('shows service config sections', async () => {
  render(<SystemPage />)
  await waitFor(() => {
    expect(screen.getByText('Radarr')).toBeInTheDocument()
    expect(screen.getByText('Sonarr')).toBeInTheDocument()
    expect(screen.getByText('Prowlarr')).toBeInTheDocument()
    expect(screen.getAllByText(/qbittorrent/i).length).toBeGreaterThanOrEqual(1)
  })
})

test('shows health status badges', async () => {
  render(<SystemPage />)
  await waitFor(() => {
    expect(screen.getByText('Stato Servizi')).toBeInTheDocument()
    expect(screen.getByText('radarr')).toBeInTheDocument()
  })
})
