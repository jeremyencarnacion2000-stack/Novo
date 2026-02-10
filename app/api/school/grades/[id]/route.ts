import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// PUT /api/school/grades/[id] - Update grade
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
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

        const body = await request.json();
        const { name, score, maxScore, weight, category, date } = body;

        const grade = await prisma.grade.findFirst({
            where: {
                id: params.id,
                userId: user.id,
            },
        });

        if (!grade) {
            return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
        }

        const updated = await prisma.grade.update({
            where: { id: params.id },
            data: {
                name: name ?? grade.name,
                score: score !== undefined ? parseFloat(score) : grade.score,
                maxScore: maxScore !== undefined ? parseFloat(maxScore) : grade.maxScore,
                weight: weight !== undefined ? parseFloat(weight) : grade.weight,
                category: category ?? grade.category,
                date: date ? new Date(date) : grade.date,
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating grade:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE /api/school/grades/[id] - Delete grade
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
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

        const grade = await prisma.grade.findFirst({
            where: {
                id: params.id,
                userId: user.id,
            },
        });

        if (!grade) {
            return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
        }

        await prisma.grade.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting grade:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
