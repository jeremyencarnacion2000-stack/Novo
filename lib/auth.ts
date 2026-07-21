import { NextAuthOptions } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import GoogleProvider from 'next-auth/providers/google'
import SpotifyProvider from 'next-auth/providers/spotify' // Import SpotifyProvider
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'
import { rateLimit } from '@/lib/rate-limit'

console.log('Auth config - NEXTAUTH_URL:', process.env.NEXTAUTH_URL)
console.log('Auth config - GOOGLE_CLIENT_ID present:', !!process.env.GOOGLE_CLIENT_ID)
console.log('Auth config - GOOGLE_CLIENT_SECRET present:', !!process.env.GOOGLE_CLIENT_SECRET)
console.log('Auth config - NEXTAUTH_SECRET present:', !!process.env.NEXTAUTH_SECRET)
console.log('Auth config - SPOTIFY_CLIENT_ID present:', !!process.env.SPOTIFY_CLIENT_ID)
console.log('Auth config - SPOTIFY_CLIENT_SECRET present:', !!process.env.SPOTIFY_CLIENT_SECRET)

// Validate required environment variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('Google OAuth credentials are missing. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.')
}
if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error('Spotify OAuth credentials are missing. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.')
}
if (!process.env.NEXTAUTH_SECRET) {
  console.error('NEXTAUTH_SECRET is missing. Please set it.')
}

/**
 * Type-Safe function with Exponential Backoff retry to refresh Google OAuth Access Token.
 */
async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  try {
    console.log('⏰ [OAuth Refresh] Starting Google token rotation for user ID:', token.id)

    let refreshToken = token.refreshToken as string | undefined

    // Fallback: Query the database if the refresh token is missing from the JWT session
    if (!refreshToken && token.id) {
      console.log('🔍 [OAuth Refresh] Refresh token missing in JWT. Querying Prisma DB Account model...')
      const dbAccount = await prisma.account.findFirst({
        where: {
          userId: token.id,
          provider: 'google'
        }
      })
      refreshToken = dbAccount?.refresh_token || undefined
    }

    if (!refreshToken) {
      console.error('❌ [OAuth Refresh] Critical: No Google refresh token found.')
      throw new Error('GoogleRefreshMissing')
    }

    const url = 'https://oauth2.googleapis.com/token'
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })

    // Type-safe Exponential Backoff helper
    const fetchWithBackoff = async (retries = 3, delay = 1000): Promise<Response> => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        })
        return response
      } catch (err) {
        if (retries > 0) {
          console.warn(`⚠️ [OAuth Refresh] Network error during token rotation. Retrying in ${delay}ms... Error:`, err)
          await new Promise((resolve) => setTimeout(resolve, delay))
          return fetchWithBackoff(retries - 1, delay * 2)
        }
        throw err
      }
    }

    const response = await fetchWithBackoff()
    const refreshedTokens = await response.json()

    if (!response.ok) {
      console.error('❌ [OAuth Refresh] Google returned token rotation error:', refreshedTokens)
      
      // If client has revoked access or refresh token is invalid (invalid_grant), trigger custom error code
      if (refreshedTokens.error === 'invalid_grant' || response.status === 400 || response.status === 401) {
        console.error('🚫 [OAuth Refresh] Credentials revoked/invalid. Forcing login redirection.')
      }
      throw refreshedTokens
    }

    console.log('✅ [OAuth Refresh] Google token successfully rotated.')
    const expiresAt = Math.floor(Date.now() / 1000 + refreshedTokens.expires_in)

    // Synchronize and update the new tokens in our Prisma database Account model
    if (token.id) {
      try {
        const dbAccount = await prisma.account.findFirst({
          where: {
            userId: token.id,
            provider: 'google'
          }
        })
        if (dbAccount) {
          await prisma.account.update({
            where: { id: dbAccount.id },
            data: {
              access_token: refreshedTokens.access_token,
              expires_at: expiresAt,
              refresh_token: refreshedTokens.refresh_token ?? refreshToken,
            }
          })
          console.log('💾 [OAuth Refresh] Prisma DB Account synchronized successfully.')
        }
      } catch (dbError) {
        console.error('⚠️ [OAuth Refresh] Failed to update Prisma DB Account:', dbError)
      }
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt,
      refreshToken: refreshedTokens.refresh_token ?? refreshToken,
      error: undefined,
    }
  } catch (error) {
    console.error('💥 [OAuth Refresh] Unhandled exception during Google token refresh:', error)
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

/**
 * Type-Safe function to refresh Spotify OAuth Access Token.
 */
async function refreshSpotifyAccessToken(token: JWT): Promise<JWT> {
  try {
    console.log('⏰ [OAuth Refresh] Starting Spotify token rotation for user ID:', token.id)

    let refreshToken = token.refreshToken as string | undefined

    if (!refreshToken && token.id) {
      const dbAccount = await prisma.account.findFirst({
        where: {
          userId: token.id,
          provider: 'spotify'
        }
      })
      refreshToken = dbAccount?.refresh_token || undefined
    }

    if (!refreshToken) {
      throw new Error('SpotifyRefreshMissing')
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    console.log('✅ [OAuth Refresh] Spotify token successfully rotated.')
    const expiresAt = Math.floor(Date.now() / 1000 + refreshedTokens.expires_in)

    // Synchronize DB
    if (token.id) {
      try {
        const dbAccount = await prisma.account.findFirst({
          where: {
            userId: token.id,
            provider: 'spotify'
          }
        })
        if (dbAccount) {
          await prisma.account.update({
            where: { id: dbAccount.id },
            data: {
              access_token: refreshedTokens.access_token,
              expires_at: expiresAt,
              refresh_token: refreshedTokens.refresh_token ?? refreshToken,
            }
          })
          console.log('💾 [OAuth Refresh] Prisma DB synchronized for Spotify.')
        }
      } catch (dbError) {
        console.error('⚠️ [OAuth Refresh] Failed to update Prisma DB for Spotify:', dbError)
      }
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt,
      refreshToken: refreshedTokens.refresh_token ?? refreshToken,
      error: undefined,
    }
  } catch (error) {
    console.error('💥 [OAuth Refresh] Unhandled exception during Spotify token refresh:', error)
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

/**
 * High-order unified Type-Safe function that evaluates and routes OAuth rotations based on provider.
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (token.provider === 'google') {
    return refreshGoogleAccessToken(token)
  }
  if (token.provider === 'spotify') {
    return refreshSpotifyAccessToken(token)
  }
  return token
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  // NextAuth's default adapter only writes the Account row's OAuth fields
  // (access_token/refresh_token/scope/...) the FIRST time a given
  // provider+providerAccountId signs in - node_modules/next-auth/core/lib/
  // callback-handler.js's getUserByAccount branch, taken on every SUBSEQUENT
  // sign-in, just reuses the existing Account and returns without touching
  // it. Concretely: every "Otorgar acceso a Drive/Calendar/Gmail" button
  // (components/connectors/connectors-client.tsx) just calls signIn('google')
  // again to request the broader scope this app needs beyond basic login -
  // the user re-consents on Google's real screen, but the newly-granted
  // scope was being silently discarded, because the stored Account row was
  // never updated. hasScope checks (app/api/integration/drive|calendar|gmail)
  // read that stale scope forever, so those connectors could never actually
  // become usable after the fact. events.signIn fires on every sign-in
  // regardless of new/existing (core/routes/callback.js), so this refreshes
  // the stored fields against what was actually just granted.
  events: {
    async signIn({ account }) {
      if (!account || account.type !== 'oauth') return
      try {
        await prisma.account.updateMany({
          where: { provider: account.provider, providerAccountId: account.providerAccountId },
          data: {
            // Only overwrite fields this grant actually returned - Google
            // only sends a refresh_token on the very first consent (or when
            // prompt=consent forces re-issue, which this provider already
            // sets - see the GoogleProvider config below), so don't null out
            // a previously-stored one if this response happens to omit it.
            ...(account.access_token ? { access_token: account.access_token } : {}),
            ...(account.refresh_token ? { refresh_token: account.refresh_token } : {}),
            ...(account.expires_at ? { expires_at: account.expires_at as number } : {}),
            ...(account.scope ? { scope: account.scope } : {}),
            ...(account.token_type ? { token_type: account.token_type } : {}),
            ...(account.id_token ? { id_token: account.id_token } : {}),
          },
        })
      } catch (error) {
        // Never block a sign-in over this - worst case the scope stays
        // stale for one more grant attempt.
        console.error('[Auth] Failed to refresh Account OAuth fields on sign-in:', (error as Error).message)
      }
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Signup already rate-limits (lib/rate-limit.ts); this, the actual
        // password-login path most requests go through, had no throttling
        // at all - unlimited bcrypt.compare attempts per IP. NextAuth's
        // RequestInternal types `headers` as a plain Record, not a Fetch
        // Headers instance - no `.get()` here.
        const ip = (req?.headers?.['x-forwarded-for'] as string) || 'unknown'
        const rl = rateLimit(`auth:credentials:${ip}`, 10, 300_000)
        if (!rl.allowed) return null

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          })

          // Unknown email, or an OAuth-only account with no password set. Return
          // null without distinguishing the two — never log the email or reveal
          // whether it's registered (avoids PII in logs + user enumeration).
          if (!user || !user.password) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
          if (!isPasswordValid) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          }
        } catch (error) {
          // Log the failure type only — never credentials, emails, or hashes.
          console.error('[Authorize] Authentication error:', (error as Error).message)
          return null
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid profile email https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/books https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/fitness.sleep.read https://www.googleapis.com/auth/fitness.heart_rate.read https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
          access_type: 'offline',
          prompt: 'consent'
        },
      },
      // Without this, NextAuth's PrismaAdapter refuses to link this Google
      // grant to an existing session (e.g. a user who signed up with a
      // different method, or is re-granting broader scopes) and silently
      // bounces to the sign-in page with no visible error — the "Conectar
      // Google" button on /connectors looked like it did nothing. Google
      // verifies email ownership itself, so trusting its email match here
      // is the normal, accepted use of this flag for a known provider.
      allowDangerousEmailAccountLinking: true,
    }),
    // Add Spotify Provider
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'user-read-email user-read-private playlist-read-private playlist-read-collaborative user-library-read user-library-modify user-read-playback-state user-modify-playback-state streaming user-read-recently-played user-top-read user-follow-read user-read-currently-playing',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // Persist the OAuth access_token and refresh_token to the JWT token
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at; // Store expiration time in seconds
        token.provider = account.provider; // Store the provider (e.g., "google", "spotify")
      }

      // Check if access token is about to expire or has expired
      const shouldRefresh = token.expiresAt && (Date.now() / 1000) > (token.expiresAt - 60)

      if (shouldRefresh) {
        return refreshAccessToken(token)
      }

      // Add user ID to token
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.picture = user.image;
      }

      return token;
    },
    async session({ session, token }) {
      // Send properties to the client, like an access_token and user id from a JWT.
      session.accessToken = token.accessToken as string;
      session.provider = token.provider as string; // Provider (google, spotify, etc.)
      session.error = token.error; // For refresh token errors
      if (token.id) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        session.user.image = token.picture;
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      console.log('🔄 [Redirect Callback] Called at:', new Date().toISOString())
      console.log('📋 [Redirect Callback] Params:', { url, baseUrl })

      // The MCP OAuth consent screen sends unauthenticated users here via
      // ?callbackUrl=/oauth/consent/<uid> and needs that resumed exactly —
      // bouncing to '/' like every other sign-in would silently break the
      // in-progress authorization flow.
      if (url.includes('/oauth/consent/')) {
        const redirectUrl = url.startsWith(baseUrl) ? url : `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`
        console.log('✅ [Redirect Callback] Resuming OAuth consent flow:', redirectUrl)
        return redirectUrl
      }

      // Redirect Spotify users to /music, others to dashboard
      const redirectUrl = url.includes('spotify') || url.includes('/music')
        ? baseUrl + '/music'
        : baseUrl + '/';
      console.log('✅ [Redirect Callback] Redirecting to:', redirectUrl)
      return redirectUrl;
    },
  },
}