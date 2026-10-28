import type { Metadata } from 'next'
import './globals.css'
import StagingBanner from '@/components/StagingBanner'

export const metadata: Metadata = {
  title: 'Kurrent | Client Portal',
  description: 'Recruiting intelligence dashboard powered by Kurrent',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <StagingBanner />
        {children}
      </body>
    </html>
  )
}
