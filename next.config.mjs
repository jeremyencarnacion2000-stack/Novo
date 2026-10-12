/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native shells use `capacitor.config.ts` to load the deployed `/app`
  // resolver. Keep the server-backed build as the default; a full static
  // export cannot represent OAuth callbacks or authenticated API routes.
  output: process.env.NEXT_PUBLIC_CAPACITOR_STATIC_EXPORT === 'true' ? 'export' : undefined,
  reactStrictMode: true,
  compress: true,
  // Type-check IS enforced at build time (tsc baseline is clean at 0 errors as of
  // 2026-07-15). Keep it enforced so TS debt can't silently accumulate again.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // The landing uses layered artwork, so shipping the source PNGs directly
    // makes the first viewport unnecessarily heavy. Native shells do not
    // render this local bundle; they load the optimized web surface remotely.
    unoptimized: process.env.NEXT_PUBLIC_CAPACITOR_STATIC_EXPORT === 'true',
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error'] }
      : false,
  },
  experimental: {
    // Reduce peak compilation memory on constrained development machines.
    // This changes build memory usage, not runtime behavior or type-check gates.
    webpackMemoryOptimizations: true,
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
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
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
