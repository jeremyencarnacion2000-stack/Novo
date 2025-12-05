import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// PUT /api/notes/[id] - Update a note
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const body = await request.json();
        const { content, type, tags, isPinned, isArchived, color } = body;

        // Verify ownership
        const existing = await prisma.quickNote.findFirst({
            where: { id, userId: user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        const note = await prisma.quickNote.update({
            where: { id },
            data: {
                ...(content !== undefined && { content }),
                ...(type && { type }),
                ...(tags !== undefined && { tags }),
                ...(isPinned !== undefined && { isPinned }),
                ...(isArchived !== undefined && { isArchived }),
                ...(color !== undefined && { color }),
            },
        });

        return NextResponse.json({ note });
    } catch (error) {
        console.error('Error updating note:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE /api/notes/[id] - Delete a note
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;

        // Verify ownership
        const existing = await prisma.quickNote.findFirst({
            where: { id, userId: user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        await prisma.quickNote.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting note:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
