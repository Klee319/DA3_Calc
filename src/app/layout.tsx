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
        {/* Glassmorphic Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 glass-card mx-4 mt-4 rounded-2xl">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rpg-accent to-rpg-rare flex items-center justify-center">
                  <span className="text-2xl">⚔️</span>
                </div>
                <span className="text-xl font-semibold text-gradient from-white to-gray-300">
                  RPG Builder
                </span>
              </Link>
              
              <div className="flex gap-2">
                {[
                  { href: '/build', label: 'ビルド', icon: '🛠️' },
                  { href: '/optimize', label: '最適化', icon: '🎯' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-4 py-2 rounded-xl hover:bg-glass-light transition-all group"
                  >
                    <span className="mr-2 group-hover:scale-110 inline-block transition-transform">
                      {item.icon}
                    </span>
                    <span className="hidden md:inline">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <main className="pt-24 pb-12 min-h-screen">
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
