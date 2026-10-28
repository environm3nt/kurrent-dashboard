'use client'

import { palette } from '@/lib/theme'
/**
 * Staging environment banner — only renders on Vercel preview deployments.
 * Uses NEXT_PUBLIC_VERCEL_ENV which Vercel auto-sets:
 *   - "production" on the production domain (app.kurrentlabs.com)
 *   - "preview" on branch/PR preview deployments
 *   - undefined in local dev
 */
export default function StagingBanner() {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV

  // Only show on preview (staging) deployments
  if (env !== 'preview') return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: palette.ink,
        color: palette.cream,
        textAlign: 'center',
        padding: '6px 0',
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.5px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      STAGING ENVIRONMENT — changes here do not affect production
    </div>
  )
}
