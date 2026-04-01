import { render, screen } from '@testing-library/react'
import { TorrentRow } from '@/components/TorrentRow'

const torrent = {
  hash: 'abc', name: 'The.Matrix.mkv', progress: 0.65,
  dlspeed: 4_200_000, eta: 240, size: 8_800_000_000,
  state: 'downloading', savePath: '/tmp', contentPath: '/tmp/movie',
}

test('renders torrent name and progress', () => {
  render(<TorrentRow torrent={torrent} onDelete={jest.fn()} onTogglePause={jest.fn()} />)
  expect(screen.getByText('The.Matrix.mkv')).toBeInTheDocument()
  expect(screen.getByText('65%')).toBeInTheDocument()
})
