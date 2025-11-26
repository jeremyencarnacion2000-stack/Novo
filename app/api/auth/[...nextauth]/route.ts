import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

console.log('NextAuth route loaded, environment check:')
console.log('NODE_ENV:', process.env.NODE_ENV)
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL)
console.log('NEXTAUTH_SECRET present:', !!process.env.NEXTAUTH_SECRET)
console.log('GOOGLE_CLIENT_ID present:', !!process.env.GOOGLE_CLIENT_ID)
console.log('DATABASE_URL present:', !!process.env.DATABASE_URL)

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }

export const dynamic = 'force-dynamic'