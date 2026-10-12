import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_PATHS = [
  '/',
  '/landing',
  '/auth/',
  '/welcome',
  '/onboarding',
  '/privacy',
  '/terms',
  '/refunds',
  '/docs',
  '/docs/',
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-protected-resource',
  '/oauth/consent/',
]

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => path !== '/' && path.endsWith('/')
    ? pathname.startsWith(path)
    : pathname === path)
}

function isPublicAsset(pathname: string) {
  return pathname === '/manifest.json' || pathname === '/sw.js' ||
    pathname.startsWith('/icons/') || pathname.startsWith('/_next/') || pathname.startsWith('/liquid-glass/') ||
    /\.(?:js|css|map|png|jpe?g|webp|svg|ico|gif|avif|woff2?|txt|xml)$/.test(pathname)
}

/**
 * Pass the request path to the root server layout. This lets the public
 * review route bypass the authenticated client shell while leaving all
 * normal application routes unchanged. No authentication or crawler is
 * blocked here; API and framework assets are excluded from the matcher.
 */
export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-novo-path', request.nextUrl.pathname)

  // API consumers must receive their JSON 401 responses, never an HTML auth
  // redirect. Static assets and acquisition/auth surfaces are also public.
  const pathname = request.nextUrl.pathname
  if (!pathname.startsWith('/api/') && !isPublicPath(pathname) && !isPublicAsset(pathname)) {
    let token = null
    try {
      token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
      })
    } catch {
      // A missing/invalid secret is an anonymous request from the product's
      // perspective. The protected route must not mount its client shell.
      token = null
    }

    if (!token) {
      const signInUrl = request.nextUrl.clone()
      signInUrl.pathname = '/auth/signin'
      signInUrl.search = ''
      signInUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`)
      return NextResponse.redirect(signInUrl)
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
