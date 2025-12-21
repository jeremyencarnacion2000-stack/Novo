'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface GPADisplayProps {
    gpa: number;
    label: string;
    description?: string;
    size?: 'small' | 'large';
    showScale?: boolean;
}

export function GPADisplay({ gpa, label, description, size = 'large', showScale = true }: GPADisplayProps) {
    const getGradeColor = (gpa: number) => {
        if (!showScale) return 'text-foreground'; // Neutral color for credits
        if (gpa >= 3.7) return 'text-green-600 dark:text-green-400';
        if (gpa >= 3.0) return 'text-blue-600 dark:text-blue-400';
        if (gpa >= 2.0) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    return (
        <Card>
            <CardHeader className={size === 'small' ? 'pb-2' : ''}>
                <CardTitle className={size === 'small' ? 'text-base' : ''}>{label}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                <div className={`${getGradeColor(gpa)} font-bold ${size === 'large' ? 'text-4xl' : 'text-2xl'}`}>
                    {gpa.toFixed(2)}
                </div>
                {showScale && (
                    <div className="text-sm text-muted-foreground mt-1">
                        / 4.0
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
