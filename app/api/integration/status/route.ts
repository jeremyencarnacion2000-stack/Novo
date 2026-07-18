/**
 * /api/integration/status
 *
 * GET — Lightweight connection status for the OAuth grants that ride on the
 * primary NextAuth Google/Spotify sign-in (Contacts, Books, YouTube all share
 * the single Google consent already requested in lib/auth.ts; Spotify is its
 * own provider). Same "does an Account row exist for this provider" check
 * already used by /api/integration/drive — just returns both in one call so
 * the Conectores page isn't firing three near-identical requests.
 */

import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accounts = await prisma.account.findMany({
        where: { userId: session.user.id, provider: { in: ['google', 'spotify'] } },
        select: { provider: true },
    });

    const providers = new Set(accounts.map(a => a.provider));

    return NextResponse.json({
        google: providers.has('google'),
        spotify: providers.has('spotify'),
    });
}
