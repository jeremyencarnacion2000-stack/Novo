import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { calculateCourseGrade, percentageToLetter } from '@/lib/gpa-calculator';

// GET /api/school/courses - Get all courses for user
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
        const semester = searchParams.get('semester');
        const year = searchParams.get('year');

        const where: any = { userId: user.id };
        if (semester) where.semester = semester;
        if (year) where.year = parseInt(year);

        const courses = await prisma.course.findMany({
            where,
            include: {
                grades: { orderBy: { date: 'desc' } },
            },
            orderBy: [
                { year: 'desc' },
                { semester: 'desc' },
                { name: 'asc' },
            ],
        });

        // Calculate final grades if not stored
        const coursesWithGrades = courses.map(course => {
            let finalGrade = course.finalGrade;
            let letterGrade = course.letterGrade;

            if (course.grades.length > 0 && !finalGrade) {
                finalGrade = calculateCourseGrade(course.grades);
                letterGrade = percentageToLetter(finalGrade);
            }

            return {
                ...course,
                finalGrade,
                letterGrade,
            };
        });

        return NextResponse.json(coursesWithGrades);
    } catch (error) {
        console.error('Error fetching courses:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/school/courses - Create new course
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
        const { name, code, credits, semester, year, professor, color, educationType } = body;

        if (!name || !semester || !year) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Require code and credits only for university
        if (educationType !== 'high_school' && (!code || !credits)) {
            return NextResponse.json(
                { error: 'Course code and credits are required for university courses' },
                { status: 400 }
            );
        }

        const course = await prisma.course.create({
            data: {
                userId: user.id,
                name,
                code: code || null,
                credits: credits ? parseFloat(credits) : null,
                semester,
                year: parseInt(year),
                professor: professor || null,
                color: color || '#3b82f6',
                educationType: educationType || 'university',
            },
            include: {
                grades: true,
            },
        });

        return NextResponse.json(course, { status: 201 });
    } catch (error) {
        console.error('Error creating course:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
