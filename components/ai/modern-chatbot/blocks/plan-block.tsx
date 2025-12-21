import React from 'react';
import { CheckCircle2, Circle, Clock, ListTodo } from 'lucide-react';
import type { PlanItem } from '../types';

interface PlanBlockProps {
    items: PlanItem[];
}

export function PlanBlock({ items }: PlanBlockProps) {
    return (
        <div className="border border-border rounded-lg bg-card overflow-hidden mb-2 shadow-sm">
            <div className="px-3 py-2 bg-secondary/30 border-b border-border/50 flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Proposed Plan</span>
            </div>
            <div className="p-3 space-y-2">
                {items.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 text-sm">
                        <div className="mt-0.5">
                            {item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            {item.status === 'pending' && <Circle className="w-4 h-4 text-muted-foreground" />}
                            {item.status === 'skipped' && <Circle className="w-4 h-4 text-muted-foreground/50" />}
                            {item.status === 'failed' && <Circle className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="flex-1">
                            <div className="font-medium text-foreground">{item.label}</div>
                            {item.description && (
                                <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
