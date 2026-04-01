// __tests__/components/Sidebar.test.tsx
import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/Sidebar'

jest.mock('next/navigation', () => ({ usePathname: () => '/' }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    className,
    children,
  }: {
    href: string
    className: string
    children: React.ReactNode
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

test('renders all 9 navigation links', () => {
  render(<Sidebar />)
  expect(screen.getByText('Dashboard')).toBeInTheDocument()
  expect(screen.getByText('Cerca')).toBeInTheDocument()
  expect(screen.getByText('Film')).toBeInTheDocument()
  expect(screen.getByText('Serie TV')).toBeInTheDocument()
  expect(screen.getByText('Download')).toBeInTheDocument()
  expect(screen.getByText('Calendario')).toBeInTheDocument()
  expect(screen.getByText('Cronologia')).toBeInTheDocument()
  expect(screen.getByText('Indexer')).toBeInTheDocument()
  expect(screen.getByText('Sistema')).toBeInTheDocument()
})

test('highlights active link for Dashboard', () => {
  render(<Sidebar />)
  const dashboardLink = screen.getByText('Dashboard').closest('a')
  expect(dashboardLink?.className).toContain('text-purple-300')
})

test('non-active links have default styling', () => {
  render(<Sidebar />)
  const searchLink = screen.getByText('Cerca').closest('a')
  expect(searchLink?.className).toContain('text-gray-400')
})
