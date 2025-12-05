import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// POST /api/school/grades - Create new grade
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
        const { courseId, name, score, maxScore, weight, category, date } = body;

        if (!courseId || !name || score === undefined || !maxScore || !weight || !category || !date) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Verify course belongs to user
        const course = await prisma.course.findFirst({
            where: {
                id: courseId,
                userId: user.id,
            },
        });

        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const grade = await prisma.grade.create({
            data: {
                userId: user.id,
                courseId,
                name,
                score: parseFloat(score),
                maxScore: parseFloat(maxScore),
                weight: parseFloat(weight),
                category,
                date: new Date(date),
            },
        });

        return NextResponse.json(grade, { status: 201 });
    } catch (error) {
        console.error('Error creating grade:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
