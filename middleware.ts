import { NextResponse, type NextRequest } from 'next/server'

/**
 * Pass the request path to the root server layout. This lets the public
 * review route bypass the authenticated client shell while leaving all
 * normal application routes unchanged. No authentication or crawler is
 * blocked here; API and framework assets are excluded from the matcher.
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-novo-path', request.nextUrl.pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
