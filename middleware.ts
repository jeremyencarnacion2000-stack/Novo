import { withAuth } from "next-auth/middleware"

export default withAuth(
   function middleware(req) {
     console.log('Middleware executed for:', req.nextUrl.pathname)
     console.log('Request method:', req.method)
     console.log('Request headers:', Object.fromEntries(req.headers))
     // Add any additional middleware logic here
   },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    },
  }
)

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"]
}