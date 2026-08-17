import type { MetadataRoute } from 'next'

const baseUrl = 'https://productivitynovo.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['/landing', '/auth/signin', '/auth/signup', '/onboarding', '/terms', '/privacy', '/refunds']
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: route === '/landing' ? 'weekly' : 'monthly',
    priority: route === '/landing' ? 1 : 0.5,
  }))
}
