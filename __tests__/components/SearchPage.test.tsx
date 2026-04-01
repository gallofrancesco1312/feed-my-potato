// __tests__/components/SearchPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchPage from '@/app/search/page'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

test('renders search input and mode buttons', () => {
  render(<SearchPage />)
  expect(screen.getByText('Cerca')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Cerca film o serie...')).toBeInTheDocument()
  expect(screen.getByText('Tutti')).toBeInTheDocument()
  expect(screen.getByText('Film')).toBeInTheDocument()
  expect(screen.getByText('Serie TV')).toBeInTheDocument()
})

test('searches and displays movie results', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      { title: 'Inception', year: 2010, tmdbId: 27205, overview: 'Un ladro...' },
    ],
  })

  const user = userEvent.setup()
  render(<SearchPage />)

  await user.click(screen.getByText('Film'))
  await user.type(screen.getByPlaceholderText('Cerca film o serie...'), 'Inception')
  await user.keyboard('{Enter}')

  await waitFor(() => {
    expect(screen.getByText('Inception')).toBeInTheDocument()
    expect(screen.getByText('2010')).toBeInTheDocument()
  })
})

test('shows Film and Serie badges in Tutti mode', async () => {
  ;(fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/radarr/lookup')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ title: 'Film Result', year: 2020, tmdbId: 1 }],
      })
    }
    if (url.includes('/api/sonarr/lookup')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ title: 'Serie Result', year: 2021, tvdbId: 2 }],
      })
    }
    return Promise.resolve({ ok: true, json: async () => [] })
  })

  const user = userEvent.setup()
  render(<SearchPage />)

  await user.type(screen.getByPlaceholderText('Cerca film o serie...'), 'test')
  await user.keyboard('{Enter}')

  await waitFor(() => {
    expect(screen.getByText('Film Result')).toBeInTheDocument()
    expect(screen.getByText('Serie Result')).toBeInTheDocument()
  })
})
