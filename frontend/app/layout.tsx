// app/layout.tsx

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import './globals.css'

import { Providers } from './providers'
import AuthGuard from '@/components/auth/AuthGuard'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
})

export const metadata: Metadata = {
  title: 'BLISS CRM',
  description: 'CRM boshqaruv tizimi',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uz">
      <body className={inter.className}>
        <Providers>
          <AuthGuard>
            {children}
          </AuthGuard>
        </Providers>
      </body>
    </html>
  )
}