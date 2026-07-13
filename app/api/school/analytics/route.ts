import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateGPA, calculateCourseGrade, percentageToLetter, getGradeDistribution } from '@/lib/gpa-calculator';

// GET /api/school/analytics - Get academic analytics
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

        // Get all courses with grades
        const courses = await prisma.course.findMany({
            where: { userId: user.id },
            include: { grades: true },
            orderBy: [
                { year: 'asc' },
                { semester: 'asc' },
            ],
        });

        // Calculate grades for each course
        const coursesWithGrades = courses.map(course => ({
            ...course,
            finalGrade: course.finalGrade ?? (course.grades.length > 0 ? calculateCourseGrade(course.grades) : undefined),
            letterGrade: course.letterGrade ?? (course.grades.length > 0 ? percentageToLetter(calculateCourseGrade(course.grades)) : undefined),
        }));

        // Calculate overall GPA
        const overallGPA = calculateGPA(coursesWithGrades.filter(c => c.finalGrade !== undefined));

        // Calculate GPA by semester
        const semesterMap = new Map<string, typeof coursesWithGrades>();
        coursesWithGrades.forEach(course => {
            const key = `${course.semester} ${course.year}`;
            if (!semesterMap.has(key)) {
                semesterMap.set(key, []);
            }
            semesterMap.get(key)!.push(course);
        });

        const semesterGPA = Array.from(semesterMap.entries()).map(([semester, courses]) => ({
            semester,
            gpa: calculateGPA(courses.filter(c => c.finalGrade !== undefined)),
            courses: courses.length,
            credits: courses.reduce((sum, c) => sum + (c.credits || 0), 0),
        }));

        // Calculate total and completed credits
        const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
        const creditsCompleted = coursesWithGrades
            .filter(c => c.letterGrade && c.letterGrade !== 'F')
            .reduce((sum, c) => sum + (c.credits || 0), 0);

        // Get grade distribution
        const distribution = getGradeDistribution(coursesWithGrades.filter(c => c.finalGrade !== undefined));
        const gradeDistribution = Object.entries(distribution)
            .map(([letter, count]) => ({ letter, count }))
            .filter(item => item.count > 0);

        // Trend data (GPA over time)
        const trendData = semesterGPA.map(({ semester, gpa }) => ({
            semester,
            gpa,
        }));

        return NextResponse.json({
            overallGPA,
            semesterGPA,
            totalCredits,
            creditsCompleted,
            gradeDistribution,
            trendData,
            totalCourses: courses.length,
            currentSemester: semesterGPA[semesterGPA.length - 1]?.semester || null,
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
