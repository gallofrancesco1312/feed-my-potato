import { render, screen, waitFor } from '@testing-library/react'
import HistoryPage from '@/app/history/page'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

test('renders history heading', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ records: [] }),
  })
  render(<HistoryPage />)
  await waitFor(() => {
    expect(screen.getByText('Cronologia')).toBeInTheDocument()
  })
})

test('displays history items', async () => {
  ;(fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/radarr/history')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          records: [
            {
              date: '2026-03-24T10:00:00Z',
              eventType: 'grabbed',
              sourceTitle: 'Inception.2010.1080p',
              quality: { quality: { name: '1080p' } },
            },
          ],
        }),
      })
    }
    return Promise.resolve({ ok: true, json: async () => ({ records: [] }) })
  })
  render(<HistoryPage />)
  await waitFor(() => {
    expect(screen.getByText('Inception.2010.1080p')).toBeInTheDocument()
    expect(screen.getByText('Scaricamento')).toBeInTheDocument()
  })
})
