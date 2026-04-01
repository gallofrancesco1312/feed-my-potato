// __tests__/components/MoviesPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import MoviesPage from '@/app/movies/page'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

test('renders movies heading', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      { id: 1, title: 'Inception', year: 2010, monitored: true, hasFile: true, images: [] },
    ],
  })
  render(<MoviesPage />)
  await waitFor(() => {
    expect(screen.getByText('Film')).toBeInTheDocument()
  })
})

test('displays movie cards with title and year', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      { id: 1, title: 'Inception', year: 2010, monitored: true, hasFile: true, images: [] },
      { id: 2, title: 'Interstellar', year: 2014, monitored: true, hasFile: false, images: [] },
    ],
  })
  render(<MoviesPage />)
  await waitFor(() => {
    expect(screen.getByText('Inception')).toBeInTheDocument()
    expect(screen.getByText('2010')).toBeInTheDocument()
    expect(screen.getByText('Interstellar')).toBeInTheDocument()
    expect(screen.getByText('2014')).toBeInTheDocument()
  })
})

test('shows status labels', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      { id: 1, title: 'Movie A', year: 2020, monitored: true, hasFile: true, images: [] },
      { id: 2, title: 'Movie B', year: 2021, monitored: true, hasFile: false, images: [] },
    ],
  })
  render(<MoviesPage />)
  await waitFor(() => {
    expect(screen.getByText('Scaricato')).toBeInTheDocument()
    expect(screen.getByText('Mancante')).toBeInTheDocument()
  })
})
