import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// GET /api/notes - Get all quick notes
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession();

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const archived = searchParams.get('archived') === 'true';
        const pinned = searchParams.get('pinned') === 'true';
        const tag = searchParams.get('tag');

        const where: any = {
            userId: user.id,
            isArchived: archived,
        };

        if (type) where.type = type;
        if (pinned) where.isPinned = true;
        if (tag) where.tags = { has: tag };

        const notes = await prisma.quickNote.findMany({
            where,
            orderBy: [
                { isPinned: 'desc' },
                { updatedAt: 'desc' },
            ],
        });

        return NextResponse.json({ notes });
    } catch (error) {
        console.error('Error fetching notes:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/notes - Create a quick note
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession();

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await request.json();
        const { content, type, tags, color } = body;

        if (!content) {
            return NextResponse.json(
                { error: 'Content is required' },
                { status: 400 }
            );
        }

        const note = await prisma.quickNote.create({
            data: {
                content,
                type: type ?? 'note',
                tags: tags ?? [],
                color,
                userId: user.id,
            },
        });

        return NextResponse.json({ note });
    } catch (error) {
        console.error('Error creating note:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
