import { render, screen, waitFor } from '@testing-library/react'
import IndexersPage from '@/app/indexers/page'

global.fetch = jest.fn()
afterEach(() => jest.resetAllMocks())

test('renders indexers heading', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] })
  render(<IndexersPage />)
  await waitFor(() => {
    expect(screen.getByText('Indexer')).toBeInTheDocument()
  })
})

test('displays indexer list with test buttons', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [
      { id: 1, name: 'Test Indexer', protocol: 'torrent', enable: true, fields: [] },
      { id: 2, name: 'Another', protocol: 'usenet', enable: false, fields: [] },
    ],
  })
  render(<IndexersPage />)
  await waitFor(() => {
    expect(screen.getByText('Test Indexer')).toBeInTheDocument()
    expect(screen.getByText('Another')).toBeInTheDocument()
    expect(screen.getByText('torrent')).toBeInTheDocument()
    expect(screen.getByText('usenet')).toBeInTheDocument()
  })
})
