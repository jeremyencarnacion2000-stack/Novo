import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/settings', '/today', '/cognitive', '/ai', '/chat'] }],
    sitemap: 'https://productivitynovo.vercel.app/sitemap.xml',
  }
}
