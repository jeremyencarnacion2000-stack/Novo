import { NextAuthOptions } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import GoogleProvider from 'next-auth/providers/google'
import SpotifyProvider from 'next-auth/providers/spotify' // Import SpotifyProvider
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'

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
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          console.log('🔐 [Authorize] ==================== START ====================')
          console.log('📋 [Authorize] Credentials received:', {
            email: credentials?.email,
            hasPassword: !!credentials?.password,
            passwordLength: credentials?.password?.length
          })

          if (!credentials?.email || !credentials?.password) {
            const error = new Error('Missing credentials')
            console.error('❌ [Authorize] EXCEPTION: Missing email or password')
            console.error('📊 [Authorize] Error Details:', {
              name: error.name,
              message: error.message,
              stack: error.stack,
              credentials: {
                emailProvided: !!credentials?.email,
                passwordProvided: !!credentials?.password
              }
            })
            return null
          }

          try {
            console.log('🔍 [Authorize] Querying database for user...')
            const user = await prisma.user.findUnique({
              where: { email: credentials.email },
            })

            console.log('📊 [Authorize] Database query result:', {
              userFound: !!user,
              userId: user?.id,
              userEmail: user?.email,
              hasPassword: !!user?.password,
              passwordHash: user?.password ? `${user.password.substring(0, 10)}...` : null
            })

            if (!user) {
              const error = new Error('User not found in database')
              console.error('❌ [Authorize] EXCEPTION: User does not exist')
              console.error('📊 [Authorize] Error Details:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                attemptedEmail: credentials.email,
                timestamp: new Date().toISOString()
              })
              return null
            }

            if (!user.password) {
              const error = new Error('User has no password (OAuth account)')
              console.error('❌ [Authorize] EXCEPTION: User exists but has no password')
              console.error('📊 [Authorize] Error Details:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                userId: user.id,
                userEmail: user.email,
                suggestion: 'User may have registered with Google OAuth'
              })
              return null
            }

            try {
              console.log('🔐 [Authorize] Comparing passwords...')
              const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
              console.log('📊 [Authorize] Password comparison result:', isPasswordValid)

              if (!isPasswordValid) {
                const error = new Error('Invalid password')
                console.error('❌ [Authorize] EXCEPTION: Password does not match')
                console.error('📊 [Authorize] Error Details:', {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                  userId: user.id,
                  userEmail: user.email,
                  providedPasswordLength: credentials.password.length,
                  storedHashLength: user.password.length
                })
                return null
              }

              console.log('✅ [Authorize] Authentication successful!')
              console.log('📊 [Authorize] Returning user:', {
                id: user.id,
                email: user.email,
                name: user.name,
                hasImage: !!user.image
              })
              console.log('🔐 [Authorize] ==================== END (SUCCESS) ====================')

              return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
              }
            } catch (bcryptError) {
              console.error('💥 [Authorize] CRITICAL EXCEPTION in bcrypt.compare')
              console.error('📊 [Authorize] Bcrypt Error Details:', {
                name: (bcryptError as Error).name,
                message: (bcryptError as Error).message,
                stack: (bcryptError as Error).stack,
                type: typeof bcryptError,
                userId: user.id
              })
              throw bcryptError
            }
          } catch (dbError) {
            console.error('💥 [Authorize] CRITICAL EXCEPTION in database query')
            console.error('📊 [Authorize] Database Error Details:', {
              name: (dbError as Error).name,
              message: (dbError as Error).message,
              stack: (dbError as Error).stack,
              type: typeof dbError,
              attemptedEmail: credentials.email
            })
            throw dbError
          }
        } catch (error) {
          console.error('💥 [Authorize] CRITICAL UNHANDLED EXCEPTION')
          console.error('📊 [Authorize] Exception Details:', {
            name: (error as Error).name,
            message: (error as Error).message,
            stack: (error as Error).stack,
            type: typeof error,
            errorObject: error
          })
          console.error('🔐 [Authorize] ==================== END (FAILURE) ====================')
          return null
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid profile email https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/books https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/fitness.sleep.read https://www.googleapis.com/auth/fitness.heart_rate.read https://www.googleapis.com/auth/drive.file',
          access_type: 'offline',
          prompt: 'consent'
        },
      },
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
      console.log('🔑 [JWT Callback] Called at:', new Date().toISOString())
      console.log('📋 [JWT Callback] Params:', {
        hasAccount: !!account,
        hasUser: !!user,
        tokenEmail: token.email,
        tokenSub: token.sub
      })

      // Persist the OAuth access_token and refresh_token to the JWT token
      if (account) {
        console.log('🔐 [JWT Callback] Account found, setting tokens')
        console.log('📊 [JWT Callback] Provider:', account.provider)
        console.log('🆔 [JWT Callback] Provider Account ID:', account.providerAccountId)

        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at; // Store expiration time in seconds
        token.provider = account.provider; // Store the provider (e.g., "google", "spotify")
      }

      // Check if access token is about to expire or has expired
      const shouldRefresh = token.expiresAt && (Date.now() / 1000) > (token.expiresAt - 60)

      if (shouldRefresh) {
        console.log(`⏰ [JWT Callback] Access token expired/expiring for ${token.provider}. Triggering rotation...`)
        return refreshAccessToken(token)
      }

      // Add user ID to token
      if (user) {
        console.log('👤 [JWT Callback] User found, adding ID to token')
        console.log('🆔 [JWT Callback] User ID:', user.id)
        token.id = user.id;
        token.name = user.name;
        token.picture = user.image;
      }

      console.log('✅ [JWT Callback] Returning token with id:', token.id)
      return token;
    },
    async session({ session, token }) {
      console.log('🎫 [Session Callback] Called at:', new Date().toISOString())
      console.log('📋 [Session Callback] Params:', {
        sessionEmail: session.user.email,
        tokenId: token.id,
        tokenEmail: token.email
      })

      // Send properties to the client, like an access_token and user id from a JWT.
      session.accessToken = token.accessToken as string;
      session.provider = token.provider as string; // Provider (google, spotify, etc.)
      session.error = token.error; // For refresh token errors
      if (token.id) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        session.user.image = token.picture;
        console.log('✅ [Session Callback] User ID added to session:', session.user.id)
      } else {
        console.warn('⚠️ [Session Callback] No token ID found!')
      }

      console.log('📤 [Session Callback] Returning session')
      return session;
    },
    async redirect({ url, baseUrl }) {
      console.log('🔄 [Redirect Callback] Called at:', new Date().toISOString())
      console.log('📋 [Redirect Callback] Params:', { url, baseUrl })

      // Redirect Spotify users to /music, others to dashboard
      const redirectUrl = url.includes('spotify') || url.includes('/music')
        ? baseUrl + '/music'
        : baseUrl + '/';
      console.log('✅ [Redirect Callback] Redirecting to:', redirectUrl)
      return redirectUrl;
    },
  },
}