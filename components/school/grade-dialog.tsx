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
import { useModalFlip } from '@/hooks/use-modal-flip';

interface Grade {
    id?: string;
    courseId: string;
    name: string;
    score: number;
    maxScore: number;
    weight: number;
    category: string;
    date: string;
}

interface GradeDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: (grade: Grade) => void;
    courseId: string;
    grade?: Grade;
}

const CATEGORY_OPTIONS = [
    'Exam',
    'Quiz',
    'Assignment',
    'Project',
    'Homework',
    'Participation',
    'Lab',
    'Presentation',
    'Paper',
    'Other',
];

export function GradeDialog({ open, onClose, onSave, courseId, grade }: GradeDialogProps) {
    const [formData, setFormData] = React.useState<Grade>({
        courseId,
        name: '',
        score: 0,
        maxScore: 100,
        weight: 10,
        category: 'Assignment',
        date: new Date().toISOString().split('T')[0],
    });

    React.useEffect(() => {
        if (grade) {
            setFormData({
                ...grade,
                date: grade.date.split('T')[0], // Convert to YYYY-MM-DD
            });
        } else {
            setFormData({
                courseId,
                name: '',
                score: 0,
                maxScore: 100,
                weight: 10,
                category: 'Assignment',
                date: new Date().toISOString().split('T')[0],
            });
        }
    }, [grade, courseId, open]);

    const percentage = formData.maxScore > 0
        ? ((formData.score / formData.maxScore) * 100).toFixed(1)
        : '0.0';

    const flipKey = `grade-${courseId}`;
    const closeFlip = useModalFlip(flipKey, open);
    const handleClose = () => closeFlip(onClose);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        handleClose();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
            <DialogContent data-flip-to={flipKey} flipAnchored className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>
                        <span data-shared-item="text">{grade ? 'Edit Grade' : 'Add Grade'}</span>
                    </DialogTitle>
                    <DialogDescription>
                        {grade ? 'Update grade information' : 'Record a new grade for this course'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        {/* Grade Name */}
                        <div className="grid gap-2">
                            <Label htmlFor="name">Grade Name *</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Midterm Exam, Assignment 1"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        {/* Category */}
                        <div className="grid gap-2">
                            <Label htmlFor="category">Category *</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(value) => setFormData({ ...formData, category: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORY_OPTIONS.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Score */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-1 grid gap-2">
                                <Label htmlFor="score">Score *</Label>
                                <Input
                                    id="score"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.score}
                                    onChange={(e) => setFormData({ ...formData, score: parseFloat(e.target.value) || 0 })}
                                    required
                                />
                            </div>

                            <div className="col-span-1 grid gap-2">
                                <Label htmlFor="maxScore">Out of *</Label>
                                <Input
                                    id="maxScore"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.maxScore}
                                    onChange={(e) => setFormData({ ...formData, maxScore: parseFloat(e.target.value) || 100 })}
                                    required
                                />
                            </div>

                            <div className="col-span-1 grid gap-2">
                                <Label>Percentage</Label>
                                <div className="h-10 flex items-center justify-center bg-secondary rounded-md font-semibold">
                                    {percentage}%
                                </div>
                            </div>
                        </div>

                        {/* Weight */}
                        <div className="grid gap-2">
                            <Label htmlFor="weight">Weight (%) *</Label>
                            <Input
                                id="weight"
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={formData.weight}
                                onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Percentage this grade contributes to final grade
                            </p>
                        </div>

                        {/* Date */}
                        <div className="grid gap-2">
                            <Label htmlFor="date">Date *</Label>
                            <Input
                                id="date"
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            {grade ? 'Update Grade' : 'Add Grade'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
