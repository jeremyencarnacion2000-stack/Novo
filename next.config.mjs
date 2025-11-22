/** @type {import('next').NextConfig} */
const nextConfig = {
  turbo: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['bcrypt'],
}

export default nextConfig
