import { PrismaClient } from '@prisma/client'

declare global {
  var __prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL!

export const prisma = global.__prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma