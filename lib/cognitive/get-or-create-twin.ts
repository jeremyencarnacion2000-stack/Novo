import { prisma } from '@/lib/prisma';

export async function getOrCreateTwin(userId: string) {
  let record = await prisma.cognitiveTwinRecord.findUnique({
    where: { userId },
  });

  if (!record) {
    record = await prisma.cognitiveTwinRecord.create({
      data: {
        userId,
        confidenceScore: 42,
        trustLevel: 'initial',
        isInitialized: false,
        totalSignals: 0,
      },
    });
  }

  return record;
}
