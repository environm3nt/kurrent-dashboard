'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { palette } from '@/lib/theme'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body style={{ backgroundColor: palette.cream, fontFamily: 'Inter, sans-serif' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            textAlign: 'center',
            maxWidth: '400px',
            padding: '40px',
          }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '12px',
                backgroundColor: palette.line,
                color: palette.ink,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Playfair Display, Georgia, serif',
                fontWeight: 700,
                fontSize: '24px',
                margin: '0 auto 24px',
              }}
            >
              K
            </div>
            <h2 style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: '20px',
              fontWeight: 700,
              color: palette.ink,
              marginBottom: '8px',
            }}>
              Something went wrong
            </h2>
            <p style={{ color: palette.secondary, fontSize: '14px', marginBottom: '24px' }}>
              We&apos;ve been notified and are looking into it.
            </p>
            <button
              onClick={reset}
              style={{
                backgroundColor: palette.ink,
                color: palette.cream,
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
