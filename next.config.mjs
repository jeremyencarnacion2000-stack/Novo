/** @type {import('next').NextConfig} */
const nextConfig = {
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
  webpack: (config) => {
    config.resolve.alias['sharp$'] = false;
    return config;
  },
}

export default nextConfig
