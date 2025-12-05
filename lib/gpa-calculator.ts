// GPA Calculation Utilities for School Module

export interface CourseGrade {
    score: number;
    maxScore: number;
    weight: number; // 0-100
}

export interface Course {
    id: string;
    credits: number;
    finalGrade?: number;
    letterGrade?: string;
    grades: CourseGrade[];
}

/**
 * Calculate course grade percentage from weighted grades
 */
export function calculateCourseGrade(grades: CourseGrade[]): number {
    if (grades.length === 0) return 0;

    const totalWeight = grades.reduce((sum, g) => sum + g.weight, 0);

    if (totalWeight === 0) return 0;

    const weightedSum = grades.reduce((sum, g) => {
        const percentage = (g.score / g.maxScore) * 100;
        return sum + (percentage * g.weight);
    }, 0);

    return weightedSum / totalWeight;
}

/**
 * Convert percentage grade to letter grade
 */
export function percentageToLetter(percentage: number): string {
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 67) return 'D+';
    if (percentage >= 63) return 'D';
    if (percentage >= 60) return 'D-';
    return 'F';
}

/**
 * Convert letter grade to GPA points (4.0 scale)
 */
export function letterToGPA(letter: string): number {
    const gpaMap: Record<string, number> = {
        'A': 4.0,
        'A-': 3.7,
        'B+': 3.3,
        'B': 3.0,
        'B-': 2.7,
        'C+': 2.3,
        'C': 2.0,
        'C-': 1.7,
        'D+': 1.3,
        'D': 1.0,
        'D-': 0.7,
        'F': 0.0
    };
    return gpaMap[letter] || 0.0;
}

/**
 * Calculate GPA from courses
 */
export function calculateGPA(courses: Course[]): number {
    if (courses.length === 0) return 0;

    const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);

    if (totalCredits === 0) return 0;

    const weightedSum = courses.reduce((sum, c) => {
        // Use stored final grade if available, otherwise calculate
        const courseGrade = c.finalGrade ?? calculateCourseGrade(c.grades);
        const letter = c.letterGrade ?? percentageToLetter(courseGrade);
        const gpa = letterToGPA(letter);
        return sum + (gpa * c.credits);
    }, 0);

    return Number((weightedSum / totalCredits).toFixed(2));
}

/**
 * Get grade distribution stats
 */
export function getGradeDistribution(courses: Course[]): Record<string, number> {
    const distribution: Record<string, number> = {
        'A': 0, 'A-': 0,
        'B+': 0, 'B': 0, 'B-': 0,
        'C+': 0, 'C': 0, 'C-': 0,
        'D+': 0, 'D': 0, 'D-': 0,
        'F': 0
    };

    courses.forEach(course => {
        const grade = course.letterGrade ?? percentageToLetter(course.finalGrade ?? calculateCourseGrade(course.grades));
        if (distribution[grade] !== undefined) {
            distribution[grade]++;
        }
    });

    return distribution;
}

/**
 * Calculate what grade is needed on final to achieve target
 */
export function calculateNeededGrade(
    currentGrades: CourseGrade[],
    finalWeight: number,
    targetPercentage: number
): number {
    const currentWeight = currentGrades.reduce((sum, g) => sum + g.weight, 0);
    const currentWeightedSum = currentGrades.reduce((sum, g) => {
        const percentage = (g.score / g.maxScore) * 100;
        return sum + (percentage * g.weight);
    }, 0);

    // targetPercentage = (currentWeightedSum + (finalScore * finalWeight)) / (currentWeight + finalWeight)
    // Solve for finalScore
    const neededScore = ((targetPercentage * (currentWeight + finalWeight)) - currentWeightedSum) / finalWeight;

    return Math.max(0, Math.min(100, neededScore));
}
