import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/AppShell'
import { SetupGuard } from '@/components/SetupGuard'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = { title: 'FeedMyPotato' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`dark ${inter.className}`} suppressHydrationWarning>
      <body className="flex h-screen overflow-hidden bg-[oklch(0.11_0.015_280)]">
        <SetupGuard />
        <AppShell>{children}</AppShell>
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
