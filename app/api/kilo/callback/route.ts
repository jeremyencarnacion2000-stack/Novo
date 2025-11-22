import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Basic JWT decoding function (since jsonwebtoken is not available)
function decodeJWT(token: string) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }

    // Decode payload (second part)
    const payload = parts[1]
    // Replace base64url chars with base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    // Add padding if needed
    const paddedBase64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')
    const decoded = Buffer.from(paddedBase64, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch (error) {
    throw new Error('Failed to decode JWT')
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(new URL('/auth/signin?error=no_token', request.url))
    }

    // Decode JWT to get kiloUserId
    let payload
    try {
      payload = decodeJWT(token)
    } catch (error) {
      console.error('JWT decode error:', error)
      return NextResponse.redirect(new URL('/auth/signin?error=invalid_token', request.url))
    }

    const kiloUserId = payload.kiloUserId
    if (!kiloUserId) {
      return NextResponse.redirect(new URL('/auth/signin?error=no_kilo_user_id', request.url))
    }

    // Get current user session
    const session = await getServerSession(authOptions)
    if (!session || !session.user || !session.user.id) {
      return NextResponse.redirect(new URL('/auth/signin?error=no_session', request.url))
    }

    // Update user with kiloUserId
    await prisma.user.update({
      where: { id: session.user.id },
      data: { kiloUserId }
    })

    // Redirect to AI page
    return NextResponse.redirect(new URL('/ai', request.url))
  } catch (error) {
    console.error('Kilo callback error:', error)
    return NextResponse.redirect(new URL('/auth/signin?error=server_error', request.url))
  }
}