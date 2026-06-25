'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Plus } from 'lucide-react';
import { percentageToLetter } from '@/lib/gpa-calculator';

import { Course, Grade } from '@/types/school';

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
            className="liquid-glass hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onClick?.(course)}
        >
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="text-lg">{course.name}</CardTitle>
                        <CardDescription className="mt-1">
                            {course.educationType === 'university' ? (
                                <>
                                    {course.code} • {course.credits} credits
                                    {course.professor && ` • ${course.professor}`}
                                </>
                            ) : (
                                <>
                                    {course.semester} {course.year}
                                    {course.professor && ` • ${course.professor}`}
                                </>
                            )}
                            <div className="mt-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${course.educationType === 'university'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                    }`}>
                                    {course.educationType === 'university' ? 'Universitario' : 'Secundaria'}
                                </span>
                            </div>
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
                    {course.grades && course.grades.length > 0 ? (
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Grades ({course.grades.length})</span>
                                <span>Latest: {(course.grades[0] as any).score}%</span>
                            </div>
                            <Progress value={(course.grades[0] as any).score} className="h-1.5" />
                        </div>
                    ) : (
                        <div className="text-xs text-muted-foreground mb-4">No grades yet</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
