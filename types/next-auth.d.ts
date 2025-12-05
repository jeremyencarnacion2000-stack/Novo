import NextAuth, { DefaultSession } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    } & DefaultSession['user']
    accessToken?: string // Spotify access token
    refreshToken?: string // Spotify refresh token  
    provider?: string // Authentication provider (e.g., \"spotify\", \"google\")
    error?: 'RefreshAccessTokenError' // Error for token refresh failures
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    accessToken?: string // Spotify access token
    refreshToken?: string // Spotify refresh token
    expiresAt?: number // Spotify access token expiry time (seconds since epoch)
    provider?: string // Authentication provider (e.g., "spotify", "google")
    id?: string // User ID
    error?: 'RefreshAccessTokenError' // Error for token refresh failures
  }
}