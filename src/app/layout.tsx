import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'RPG Character Builder',
  description: 'Minecraft RPG ビルド最適化ツール',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="dark">
      <body className={inter.variable}>
        {/* Inline Navigation - シンプルなインラインヘッダー */}
        <header className="border-b border-gray-800/50">
          <div className="container mx-auto px-3 sm:px-4">
            <div className="flex items-center justify-between h-12 sm:h-14">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-lg">⚔️</span>
                <span className="text-sm sm:text-base font-medium text-gray-200">
                  RPG Builder
                </span>
              </Link>

              <div className="flex items-center gap-1">
                {[
                  { href: '/build', label: 'ビルド', icon: '🛠️' },
                  { href: '/optimize', label: '最適化', icon: '🎯' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md hover:bg-gray-800/50 transition-colors text-xs sm:text-sm text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    <span>{item.icon}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="pb-8 min-h-screen">
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
