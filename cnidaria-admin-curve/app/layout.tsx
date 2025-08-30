import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { HeaderProvider } from '../src/contexts/HeaderContext'
import '../src/index.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Cnidaria Admin Curve',
  description: 'Mathematical curve processing and visualization',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <HeaderProvider>
          {children}
        </HeaderProvider>
      </body>
    </html>
  )
}
