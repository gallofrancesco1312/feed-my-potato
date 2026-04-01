import { render, screen, waitFor } from '@testing-library/react'
import DashboardPage from '@/app/page'

global.fetch = jest.fn()

beforeEach(() => {
  ;(global as any).EventSource = jest.fn(() => ({
    onmessage: null,
    onerror: null,
    close: jest.fn(),
  }))
  ;(fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/system/health')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ radarr: true, sonarr: true, prowlarr: true, qbittorrent: true }),
      })
    }
    if (url.includes('/api/radarr/movie')) {
      return Promise.resolve({ ok: true, json: async () => [{ id: 1 }, { id: 2 }] })
    }
    if (url.includes('/api/sonarr/series')) {
      return Promise.resolve({ ok: true, json: async () => [{ id: 1 }] })
    }
    return Promise.resolve({ ok: true, json: async () => [] })
  })
})

afterEach(() => jest.resetAllMocks())

test('renders dashboard heading', async () => {
  render(<DashboardPage />)
  await waitFor(() => {
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})

test('renders stat cards', async () => {
  render(<DashboardPage />)
  await waitFor(() => {
    expect(screen.getByText('Film')).toBeInTheDocument()
    expect(screen.getByText('Serie TV')).toBeInTheDocument()
    expect(screen.getByText('Download')).toBeInTheDocument()
    expect(screen.getByText('Servizi')).toBeInTheDocument()
  })
})

test('shows health status badges', async () => {
  render(<DashboardPage />)
  await waitFor(() => {
    expect(screen.getByText('Stato Servizi')).toBeInTheDocument()
    expect(screen.getByText('radarr')).toBeInTheDocument()
    expect(screen.getByText('sonarr')).toBeInTheDocument()
  })
})
