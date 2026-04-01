import { render, screen, waitFor } from '@testing-library/react'
import CalendarPage from '@/app/calendar/page'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

test('renders calendar heading', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] })
  render(<CalendarPage />)
  await waitFor(() => {
    expect(screen.getByText('Calendario')).toBeInTheDocument()
  })
})

test('displays calendar items sorted by date', async () => {
  ;(fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/radarr/calendar')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ title: 'New Movie', inCinemas: '2026-04-01', hasFile: false }],
      })
    }
    if (url.includes('/api/sonarr/calendar')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            title: 'Episode Title',
            seriesTitle: 'Test Series',
            seasonNumber: 2,
            episodeNumber: 5,
            airDateUtc: '2026-03-28',
            hasFile: false,
          },
        ],
      })
    }
    return Promise.resolve({ ok: true, json: async () => [] })
  })
  render(<CalendarPage />)
  await waitFor(() => {
    expect(screen.getByText('New Movie')).toBeInTheDocument()
    expect(screen.getByText(/Test Series S02E05/)).toBeInTheDocument()
  })
})
