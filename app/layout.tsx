import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = { title: 'FeedMyPlex' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`dark ${inter.className}`} suppressHydrationWarning>
      <body className="flex h-screen overflow-hidden bg-[oklch(0.11_0.015_280)]">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-6 lg:p-8">
            {children}
          </div>
        </main>
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: 'glass-card-elevated !rounded-xl !border-white/10 !text-white',
          }}
        />
      </body>
    </html>
  )
}
