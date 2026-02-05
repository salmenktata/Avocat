const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mode standalone requis pour Docker production
  output: 'standalone',

  images: {
    domains: [
      'your-project.supabase.co', // Pour les images stockées sur Supabase (legacy)
      'localhost', // Pour développement local avec MinIO
    ],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'minio',
        port: '9000',
        pathname: '/documents/**',
      },
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_APP_DOMAIN || 'moncabinet.tn',
        pathname: '/api/storage/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Pour les uploads de documents
    },
  },
}

module.exports = withNextIntl(nextConfig)
