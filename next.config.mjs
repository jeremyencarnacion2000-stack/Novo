/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Temporarily add this to bypass prerendering errors
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    unoptimized: false,
  },
  experimental: {
    optimizePackageImports: ['@xenova/transformers'],
  },
  serverExternalPackages: ['bcrypt', '@prisma/client', 'prisma'],
  // Optimize for Vercel serverless functions
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)', // Apply to all routes
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors 'self' https://open.spotify.com/ https://adgen-dev.spotify.com/account/*/ad/*/details https://adgen-dev.spotify.com/preview/* https://local.spotify.net/account/*/ad/*/details https://local.spotify.net/preview/* https://app.smartly.io/*;`
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias['sharp$'] = false;
    return config;
  },
}

export default nextConfig
