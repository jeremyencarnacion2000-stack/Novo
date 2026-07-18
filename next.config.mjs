/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_PUBLIC_CAPACITOR === 'true' ? 'export' : undefined,
  reactStrictMode: true,
  compress: true,
  // Type-check IS enforced at build time (tsc baseline is clean at 0 errors as of
  // 2026-07-15). Keep it enforced so TS debt can't silently accumulate again.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    unoptimized: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error'] }
      : false,
  },
  experimental: {
    // Deep tree-shaking: only ship icons/components actually imported
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-select',
      '@radix-ui/react-accordion',
      '@radix-ui/react-scroll-area',
    ],
  },
  // ponytail: --webpack flag required for prod builds on Windows; Turbopack native binary segfaults
  serverExternalPackages: ['bcrypt', '@prisma/client', 'prisma', 'onnxruntime-node', '@xenova/transformers'],
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
