import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/templates - Get all templates
export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const category = searchParams.get('category');
        const includePublic = searchParams.get('includePublic') === 'true';

        // Build where clause
        const where: any = includePublic
            ? { OR: [{ userId: user.id }, { isPublic: true }] }
            : { userId: user.id };

        if (type) where.type = type;
        if (category) where.category = category;

        const templates = await prisma.template.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json({ templates });
    } catch (error) {
        console.error('Error fetching templates:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/templates - Create a template
export async function POST(request: NextRequest) {
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

        const body = await request.json();
        const { name, description, type, category, content, isPublic } = body;

        if (!name || !type || !content) {
            return NextResponse.json(
                { error: 'Missing required fields: name, type, content' },
                { status: 400 }
            );
        }

        const template = await prisma.template.create({
            data: {
                name,
                description,
                type,
                category,
                content,
                isPublic: isPublic ?? false,
                userId: user.id,
            },
        });

        return NextResponse.json({ template });
    } catch (error) {
        console.error('Error creating template:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
