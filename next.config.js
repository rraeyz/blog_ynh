/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production'
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ],
    }]
  },
  experimental: {
    // src/instrumentation.ts: açılışta günlük/haftalık otomatik işler
    instrumentationHook: true,
    // better-sqlite3 .node binary'si bundle'lanamaz; runtime'da node_modules'dan yüklenir
    serverComponentsExternalPackages: ['sharp', 'better-sqlite3', '@prisma/client', '@prisma/adapter-better-sqlite3', '@prisma/driver-adapter-utils', 'bcryptjs'],
    outputFileTracingIncludes: {
      '/': ['./generated/**/*', './node_modules/@prisma/**/*', './node_modules/better-sqlite3/**/*', './node_modules/bcryptjs/**/*', './node_modules/sharp/**/*', './node_modules/@img/**/*'],
    },
  },
}

module.exports = nextConfig
