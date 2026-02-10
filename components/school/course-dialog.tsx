'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Course {
    id?: string;
    name: string;
    code?: string;
    credits?: number;
    semester: string;
    year: number;
    professor?: string;
    color: string;
    educationType: string;
}

interface CourseDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: (course: Course) => void;
    course?: Course;
}

const SEMESTER_OPTIONS = ['Spring', 'Summer', 'Fall', 'Winter'];
const COLOR_OPTIONS = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Cyan', value: '#06b6d4' },
];

export function CourseDialog({ open, onClose, onSave, course }: CourseDialogProps) {
    const currentYear = new Date().getFullYear();
    const [formData, setFormData] = React.useState<Course>({
        name: '',
        code: '',
        credits: 1,
        semester: 'Fall',
        year: currentYear,
        professor: '',
        color: '#3b82f6',
        educationType: 'university',
    });

    React.useEffect(() => {
        if (course) {
            setFormData(course);
        } else {
            setFormData({
                name: '',
                code: '',
                credits: 1,
                semester: 'Fall',
                year: currentYear,
                professor: '',
                color: '#3b82f6',
                educationType: 'university',
            });
        }
    }, [course, currentYear, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{course ? 'Edit Course' : 'Add New Course'}</DialogTitle>
                    <DialogDescription>
                        {course ? 'Update course information' : 'Create a new course to track'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        {/* Course Name */}
                        <div className="grid gap-2">
                            <Label htmlFor="name">Course Name *</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Introduction to Computer Science"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        {/* Course Code */}
                        {formData.educationType !== 'high_school' && (
                            <div className="grid gap-2">
                                <Label htmlFor="code">Course Code *</Label>
                                <Input
                                    id="code"
                                    placeholder="e.g., CS 101"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    required
                                />
                            </div>
                        )}

                        {/* Credits */}
                        {formData.educationType !== 'high_school' && (
                            <div className="grid gap-2">
                                <Label htmlFor="credits">Credits *</Label>
                                <Input
                                    id="credits"
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    placeholder="3"
                                    value={formData.credits}
                                    onChange={(e) => setFormData({ ...formData, credits: parseFloat(e.target.value) })}
                                    required
                                />
                            </div>
                        )}

                        {/* Semester and Year */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="semester">Semester *</Label>
                                <Select
                                    value={formData.semester}
                                    onValueChange={(value) => setFormData({ ...formData, semester: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SEMESTER_OPTIONS.map((sem) => (
                                            <SelectItem key={sem} value={sem}>
                                                {sem}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="year">Year *</Label>
                                <Input
                                    id="year"
                                    type="number"
                                    min="2020"
                                    max="2030"
                                    value={formData.year}
                                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                                    required
                                />
                            </div>
                        </div>

                        {/* Education Type */}
                        <div className="grid gap-2">
                            <Label htmlFor="educationType">Education Type *</Label>
                            <Select
                                value={formData.educationType}
                                onValueChange={(value) => setFormData({ ...formData, educationType: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select education type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="university">Universitario</SelectItem>
                                    <SelectItem value="high_school">Secundaria</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Professor */}
                        <div className="grid gap-2">
                            <Label htmlFor="professor">Professor (optional)</Label>
                            <Input
                                id="professor"
                                placeholder="e.g., Dr. Smith"
                                value={formData.professor}
                                onChange={(e) => setFormData({ ...formData, professor: e.target.value })}
                            />
                        </div>

                        {/* Color */}
                        <div className="grid gap-2">
                            <Label>Color</Label>
                            <div className="flex gap-2">
                                {COLOR_OPTIONS.map((color) => (
                                    <button
                                        key={color.value}
                                        type="button"
                                        className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === color.value
                                            ? 'border-primary scale-110'
                                            : 'border-transparent hover:scale-105'
                                            }`}
                                        style={{ backgroundColor: color.value }}
                                        onClick={() => setFormData({ ...formData, color: color.value })}
                                        title={color.name}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            {course ? 'Update Course' : 'Add Course'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
