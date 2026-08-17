/**
 * /api/integration/custom
 *
 * Generic "custom API" connector — reuses the existing IntegrationAccount
 * model (same table Notion/Drive use) instead of a new one. Provider is
 * namespaced as `custom:<slug>` so a user can save more than one, since
 * IntegrationAccount is unique on (userId, provider).
 *
 * This does NOT call anything — it only stores the record. No backend
 * exists yet to act on a custom connector, so the UI must present it as
 * "saved, activation pending", not as a working connection.
 *
 * GET    — list saved custom connectors
 * POST   — save one { name, baseUrl, apiKey? }
 * DELETE — remove one, ?provider=custom:<slug>
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const customConnectorSchema = z.object({
    name: z.string().trim().min(1).max(100),
    baseUrl: z.string().trim().url().max(2048),
    apiKey: z.string().trim().max(500).optional().default(''),
});

function slugify(name: string) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accounts = await prisma.integrationAccount.findMany({
        where: { userId: session.user.id, provider: { startsWith: 'custom:' } },
        orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
        connectors: accounts.map(a => {
            const meta = a.metadata as any;
            return {
                provider: a.provider,
                name: meta?.name ?? a.provider.replace('custom:', ''),
                baseUrl: meta?.baseUrl ?? '',
                hasApiKey: !!a.accessToken,
                createdAt: a.createdAt,
            };
        }),
    });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = customConnectorSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'name y baseUrl son obligatorios' }, { status: 400 });
    }
    const { name, baseUrl, apiKey } = parsed.data;

    const slug = slugify(name) || `custom-${Date.now()}`;
    const provider = `custom:${slug}`;

    const account = await prisma.integrationAccount.upsert({
        where: { userId_provider: { userId: session.user.id, provider } },
        update: { accessToken: apiKey, metadata: { name, baseUrl, custom: true } },
        create: {
            userId: session.user.id,
            provider,
            accessToken: apiKey,
            metadata: { name, baseUrl, custom: true },
        },
    });

    return NextResponse.json({ saved: true, provider: account.provider, name, baseUrl });
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');
    if (!provider || !provider.startsWith('custom:')) {
        return NextResponse.json({ error: 'provider inválido' }, { status: 400 });
    }

    try {
        await prisma.integrationAccount.delete({
            where: { userId_provider: { userId: session.user.id, provider } },
        });
    } catch {
        // Didn't exist — treat as success
    }
    return NextResponse.json({ disconnected: true });
}
