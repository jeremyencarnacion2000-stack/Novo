import { prisma } from '@/lib/prisma';

export async function getOrCreateTwin(userId: string) {
  // `userId` is unique. A read-then-create sequence races when a provider
  // sync and the ambient heartbeat initialize the Twin at the same time; the
  // losing request used to leak a P2002 and abort context acquisition. Upsert
  // makes initialization converge while leaving an existing record untouched.
  return prisma.cognitiveTwinRecord.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      // Explicitly uncalibrated until owned signals have been observed.
      confidenceScore: 0,
      trustLevel: 'initial',
      isInitialized: false,
      totalSignals: 0,
    },
  });
}
