export interface Grade {
    id: string;
    userId: string;
    courseId?: string;
    name: string;
    score: number;
    maxScore: number;
    weight: number;
    category: string;
    date: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Course {
    id: string;
    userId: string;
    name: string;
    code?: string;
    credits: number;
    semester: string;
    year: number;
    professor?: string;
    color: string;
    educationType: string;
    finalGrade?: number;
    letterGrade?: string;
    grades?: Grade[];
    createdAt?: Date;
    updatedAt?: Date;
}
