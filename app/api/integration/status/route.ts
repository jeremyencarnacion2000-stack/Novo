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
import { hasGoogleScopes } from '@/lib/google-account';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, {
            status: 401,
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        });
    }

    const accounts = await prisma.account.findMany({
        where: { userId: session.user.id, provider: { in: ['google', 'spotify'] } },
        select: { provider: true, scope: true },
    });
    const pluginAccounts = await prisma.integrationAccount.findMany({
        where: { userId: session.user.id, provider: { in: ['notion', 'todoist', 'slack'] } },
        select: { provider: true },
    });

    const providers = new Set(accounts.map(a => a.provider));
    const plugins = new Set(pluginAccounts.map(account => account.provider));
    const googleScopes = accounts
        .filter((account) => account.provider === 'google')
        .map((account) => account.scope);
    const hasScope = (scope: string) => googleScopes.some((value) => hasGoogleScopes(value, [scope]));

    const response = NextResponse.json({
        notion: plugins.has('notion'),
        todoist: plugins.has('todoist'),
        slack: plugins.has('slack'),
        google: providers.has('google'),
        spotify: providers.has('spotify'),
        // Keep the provider booleans for existing surfaces, and expose
        // capability-level status for lightweight chat surfaces. A basic
        // Google login must not imply Gmail, Calendar, or Drive access.
        gmail: hasScope('gmail.readonly'),
        calendar: hasScope('calendar'),
        drive: hasScope('drive.file'),
    });
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;
}
