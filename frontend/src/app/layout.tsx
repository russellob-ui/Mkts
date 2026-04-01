import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { CommandPalette } from '@/components/CommandPalette'
import { AlertPanel } from '@/components/layout/AlertPanel'
import { QueryProvider } from '@/providers/QueryProvider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MKTS — Market Terminal',
  description: 'Personal market research terminal',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'MKTS' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A0B0F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme — reads persisted Zustand state synchronously */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('mkts-ui')||'{}');if(s.state&&s.state.theme==='light')document.documentElement.classList.add('light')}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <QueryProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 md:ml-48 transition-all duration-200">
              <TopBar />
              <main className="flex-1 overflow-y-auto pt-11 pb-16 md:pb-0">
                {children}
              </main>
            </div>
          </div>
          <BottomNav />
          <CommandPalette />
          <AlertPanel />
        </QueryProvider>
      </body>
    </html>
  )
}
