import React from 'react';
import { CheckCircle2, Circle, Clock, ListTodo, AlertCircle, HelpCircle } from 'lucide-react';
import type { PlanItem } from '../types';

interface PlanBlockProps {
    items: PlanItem[];
}

export function PlanBlock({ items }: PlanBlockProps) {
    return (
        <div className="border border-white/[0.08] rounded-xl bg-white/[0.015] overflow-hidden mb-3 shadow-md w-full min-w-0">
            <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-bold tracking-widest uppercase text-white/95">Plan Propuesto</span>
            </div>
            <div className="p-3.5 space-y-3 min-w-0 w-full">
                {items.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 text-sm min-w-0 w-full">
                        <div className="mt-0.5 shrink-0">
                            {item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                            {item.status === 'pending' && <Circle className="w-4 h-4 text-white/35" />}
                            {item.status === 'skipped' && <HelpCircle className="w-4 h-4 text-white/20" />}
                            {item.status === 'failed' && <AlertCircle className="w-4 h-4 text-rose-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div 
                                className="font-semibold text-[13.5px] text-white/90 leading-snug break-words"
                                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                            >
                                {item.label}
                            </div>
                            {item.description && (
                                <div 
                                    className="text-xs text-white/45 mt-1 break-words leading-relaxed"
                                    style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                                >
                                    {item.description}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
