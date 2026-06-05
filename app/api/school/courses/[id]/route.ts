import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { calculateCourseGrade, percentageToLetter } from '@/lib/gpa-calculator';

// GET /api/school/courses/[id] - Get single course with grades
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        const course = await prisma.course.findFirst({
            where: {
                id,
                userId: user.id,
            },
            include: {
                grades: {
                    orderBy: { date: 'desc' },
                },
            },
        });

        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        // Calculate final grade
        let finalGrade = course.finalGrade;
        let letterGrade = course.letterGrade;

        if (course.grades.length > 0 && !finalGrade) {
            finalGrade = calculateCourseGrade(course.grades);
            letterGrade = percentageToLetter(finalGrade);
        }

        return NextResponse.json({
            ...course,
            finalGrade,
            letterGrade,
        });
    } catch (error) {
        console.error('Error fetching course:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PUT /api/school/courses/[id] - Update course
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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
        const { name, code, credits, semester, year, professor, color, educationType } = body;

        const course = await prisma.course.findFirst({
            where: {
                id,
                userId: user.id,
            },
        });

        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const updated = await prisma.course.update({
            where: { id },
            data: {
                name: name ?? course.name,
                code: code !== undefined ? (code || null) : course.code,
                credits: credits !== undefined ? (credits ? parseFloat(credits) : null) : course.credits,
                semester: semester ?? course.semester,
                year: year !== undefined ? parseInt(year) : course.year,
                professor: professor !== undefined ? professor : course.professor,
                color: color ?? course.color,
                educationType: educationType ?? course.educationType,
            },
            include: {
                grades: true,
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating course:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE /api/school/courses/[id] - Delete course
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        const course = await prisma.course.findFirst({
            where: {
                id,
                userId: user.id,
            },
        });

        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        await prisma.course.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting course:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
