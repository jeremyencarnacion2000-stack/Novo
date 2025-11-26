import { NextAuthOptions, User } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import { prisma } from "./prisma"

// Validate required environment variables
console.log('Auth config loading...')
console.log('NEXTAUTH_SECRET is set:', !!process.env.NEXTAUTH_SECRET)
console.log('GOOGLE_CLIENT_ID is set:', !!process.env.GOOGLE_CLIENT_ID)
console.log('GOOGLE_CLIENT_SECRET is set:', !!process.env.GOOGLE_CLIENT_SECRET)
console.log('NEXTAUTH_URL is set:', !!process.env.NEXTAUTH_URL)
console.log('VERCEL_URL is set:', !!process.env.VERCEL_URL)
console.log('DATABASE_URL is set:', !!process.env.DATABASE_URL)

if (!process.env.NEXTAUTH_SECRET) {
  console.error('NEXTAUTH_SECRET is missing - this will cause configuration errors')
  throw new Error('NEXTAUTH_SECRET is not set')
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing - Prisma adapter will fail')
  throw new Error('DATABASE_URL is not set')
}

console.log('Auth config initialized successfully')

export const authOptions: NextAuthOptions = {
  debug: true,
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    },
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    },
    state: {
      name: 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('signIn callback:', { user: user?.email, account: account?.provider, profile: profile?.name })
      return true
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id,
          name: token.name,
          email: token.email as string,
          role: token.role,
        };
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      console.log('redirect callback:', { url, baseUrl })
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
}