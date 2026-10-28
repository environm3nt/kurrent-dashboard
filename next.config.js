const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverActions: {
      allowedOrigins: [
        'app.kurrentlabs.com',
        'localhost:3000',
        // Allow Vercel preview deployments (staging)
        ...(process.env.VERCEL_URL ? [process.env.VERCEL_URL] : []),
      ],
    },
  },
}

module.exports = withSentryConfig(nextConfig, {
  // Suppress source map upload warnings when SENTRY_AUTH_TOKEN is not set (local dev)
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps for better stack traces in production
  widenClientFileUpload: true,

  // Hide source maps from users
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger in production
  disableLogger: true,
})
