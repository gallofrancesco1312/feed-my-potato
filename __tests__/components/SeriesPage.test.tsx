// __tests__/components/SeriesPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import SeriesPage from '@/app/series/page'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

test('renders series heading', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      {
        id: 1,
        title: 'Breaking Bad',
        year: 2008,
        monitored: true,
        statistics: { episodeFileCount: 62, episodeCount: 62, seasonCount: 5 },
        images: [],
      },
    ],
  })
  render(<SeriesPage />)
  await waitFor(() => {
    expect(screen.getByText('Serie TV')).toBeInTheDocument()
  })
})

test('displays series with episode counts', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      {
        id: 1,
        title: 'Breaking Bad',
        year: 2008,
        monitored: true,
        statistics: { episodeFileCount: 62, episodeCount: 62, seasonCount: 5 },
        images: [],
      },
    ],
  })
  render(<SeriesPage />)
  await waitFor(() => {
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    expect(screen.getByText(/5 stagioni/)).toBeInTheDocument()
    expect(screen.getByText(/62\/62 episodi/)).toBeInTheDocument()
  })
})
