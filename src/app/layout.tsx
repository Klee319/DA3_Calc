import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://klee319.github.io/DA3_Calc_DP'),
  title: 'DA Build Calculator',
  description: 'Dungeon Adventure ビルド計算ツール',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'DA Build Calculator',
    description: 'Dungeon Adventure ビルド計算ツール',
    type: 'website',
    images: [
      {
        url: '/favicon.png',
        width: 128,
        height: 128,
        alt: 'DA Build Calculator',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'DA Build Calculator',
    description: 'Dungeon Adventure ビルド計算ツール',
    images: ['/favicon.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="dark">
      <body className={inter.variable}>
        <main className="min-h-screen">
          {children}
        </main>

        {/* Background Effects */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-rpg-accent/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-rpg-rare/20 rounded-full blur-3xl" />
        </div>
      </body>
    </html>
  )
}
