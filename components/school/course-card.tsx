'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Plus } from 'lucide-react';
import { percentageToLetter } from '@/lib/gpa-calculator';

interface Grade {
    id: string;
    name: string;
    score: number;
    maxScore: number;
    weight: number;
    category: string;
    date: Date;
}

interface Course {
    id: string;
    name: string;
    code: string;
    credits: number;
    semester: string;
    year: number;
    professor?: string;
    color: string;
    finalGrade?: number;
    letterGrade?: string;
    grades: Grade[];
}

interface CourseCardProps {
    course: Course;
    onEdit: (course: Course) => void;
    onDelete: (id: string) => void;
    onAddGrade: (course: Course) => void;
    onClick?: (course: Course) => void;
}

export function CourseCard({ course, onEdit, onDelete, onAddGrade, onClick }: CourseCardProps) {
    const gradePercentage = course.finalGrade ?? 0;
    const letterGrade = course.letterGrade ?? percentageToLetter(gradePercentage);

    // Calculate progress bar width
    const progressWidth = Math.min(100, Math.max(0, gradePercentage));

    return (
        <Card
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onClick?.(course)}
        >
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="text-lg">{course.name}</CardTitle>
                        <CardDescription className="mt-1">
                            {course.code} • {course.credits} credits
                            {course.professor && ` • ${course.professor}`}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddGrade(course);
                            }}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(course);
                            }}
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete ${course.name}?`)) {
                                    onDelete(course.id);
                                }
                            }}
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <div className="space-y-2">
                    {/* Grade Display */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Current Grade</span>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold">{letterGrade}</span>
                            <span className="text-sm text-muted-foreground">
                                {gradePercentage > 0 ? `${gradePercentage.toFixed(1)}%` : 'No grades'}
                            </span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                            className="h-full transition-all duration-300"
                            style={{
                                width: `${progressWidth}%`,
                                backgroundColor: course.color,
                            }}
                        />
                    </div>

                    {/* Grades Count */}
                    <div className="text-xs text-muted-foreground">
                        {course.grades.length} grade{course.grades.length !== 1 ? 's' : ''} recorded
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
