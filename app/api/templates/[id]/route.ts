import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/templates/[id] - Get a specific template
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

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

        const template = await prisma.template.findFirst({
            where: {
                id,
                OR: [{ userId: user.id }, { isPublic: true }],
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json({ template });
    } catch (error) {
        console.error('Error fetching template:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PUT /api/templates/[id] - Update a template
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

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
        const { name, description, type, category, content, isPublic } = body;

        // Verify ownership
        const existing = await prisma.template.findFirst({
            where: { id, userId: user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        const template = await prisma.template.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(type && { type }),
                ...(category !== undefined && { category }),
                ...(content && { content }),
                ...(isPublic !== undefined && { isPublic }),
            },
        });

        return NextResponse.json({ template });
    } catch (error) {
        console.error('Error updating template:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

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
        const existing = await prisma.template.findFirst({
            where: { id, userId: user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        await prisma.template.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting template:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/templates/[id]/use - Use a template (increment usage and clone)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

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

        const template = await prisma.template.findFirst({
            where: {
                id,
                OR: [{ userId: user.id }, { isPublic: true }],
            },
        });

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        // Increment usage count
        await prisma.template.update({
            where: { id },
            data: { usageCount: { increment: 1 } },
        });

        // Return the content to be used by the client
        return NextResponse.json({
            content: template.content,
            type: template.type,
            name: template.name,
        });
    } catch (error) {
        console.error('Error using template:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
