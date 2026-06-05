'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { calculateGPA } from '@/lib/gpa-calculator';
import { Course } from '@/types/school';

interface SchoolAnalyticsProps {
    courses: Course[];
}

export function SchoolAnalytics({ courses }: SchoolAnalyticsProps) {
    // 1. GPA Trend Data
    const getGPATrendData = () => {
        // Group courses by semester
        const semesters: Record<string, Course[]> = {};
        courses.forEach((course: any) => {
            const key = `${course.semester} ${course.year}`;
            if (!semesters[key]) semesters[key] = [];
            semesters[key].push(course);
        });

        // Calculate GPA for each semester
        const data = Object.entries(semesters).map(([semester, semesterCourses]) => {
            const gpa = calculateGPA(semesterCourses as any);
            // Parse semester for sorting (Fall > Summer > Spring for same year)
            const [sem, yearStr] = semester.split(' ');
            const year = parseInt(yearStr);
            let semOrder = 0;
            if (sem === 'Spring') semOrder = 1;
            if (sem === 'Summer') semOrder = 2;
            if (sem === 'Fall') semOrder = 3;
            if (sem === 'Winter') semOrder = 4;

            return {
                name: semester,
                gpa: parseFloat(gpa.toFixed(2)),
                year,
                semOrder
            };
        });

        // Sort chronologically
        return data.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.semOrder - b.semOrder;
        });
    };

    // 2. Grade Distribution Data
    const getGradeDistributionData = () => {
        const distribution: Record<string, number> = {
            'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0
        };

        courses.forEach((course: any) => {
            if (course.letterGrade) {
                // Normalize letter grade (A+, A- -> A)
                const letter = course.letterGrade.charAt(0).toUpperCase();
                if (distribution[letter] !== undefined) {
                    distribution[letter]++;
                }
            } else if (course.finalGrade !== undefined) {
                // Convert number to letter if needed
                let letter = 'F';
                if (course.finalGrade >= 90) letter = 'A';
                else if (course.finalGrade >= 80) letter = 'B';
                else if (course.finalGrade >= 70) letter = 'C';
                else if (course.finalGrade >= 60) letter = 'D';

                if (distribution[letter] !== undefined) {
                    distribution[letter]++;
                }
            }
        });

        return Object.entries(distribution)
            .filter(([_, count]) => count > 0)
            .map(([grade, count]) => ({
                name: grade,
                count
            }));
    };

    const trendData = getGPATrendData();
    const distributionData = getGradeDistributionData();

    if (courses.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <p>Add courses to see analytics</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GPA Trend Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>GPA Trend</CardTitle>
                    <CardDescription>Your GPA performance over time</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="name" fontSize={12} tickMargin={10} />
                                <YAxis domain={[0, 4]} fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }}
                                    itemStyle={{ color: 'var(--foreground)' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="gpa"
                                    stroke="var(--primary)"
                                    strokeWidth={3}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Grade Distribution Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Grade Distribution</CardTitle>
                    <CardDescription>Breakdown of your letter grades</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={distributionData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickMargin={10} />
                                <YAxis allowDecimals={false} fontSize={12} />
                                <Tooltip
                                    cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                                    contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }}
                                    itemStyle={{ color: 'var(--foreground)' }}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {distributionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={
                                            entry.name === 'A' ? '#22c55e' :
                                                entry.name === 'B' ? '#3b82f6' :
                                                    entry.name === 'C' ? '#eab308' :
                                                        '#ef4444'
                                        } />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
