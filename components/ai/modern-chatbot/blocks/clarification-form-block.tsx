import React, { useState } from 'react';
import { HelpCircle, ArrowRight } from 'lucide-react';
import type { ClarificationRequest } from '../types';

interface ClarificationFormBlockProps {
    request: ClarificationRequest;
    status: 'waiting' | 'confirmed' | 'cancelled' | 'pending';
    onSubmit: (values: Record<string, any>) => void;
}

export function ClarificationFormBlock({ request, status, onSubmit }: ClarificationFormBlockProps) {
    const [values, setValues] = useState<Record<string, any>>({});

    const setField = (key: string, value: any) => setValues(prev => ({ ...prev, [key]: value }));

    const isComplete = (request.fields || []).every(f => !f.required || (values[f.key] !== undefined && values[f.key] !== ''));

    if (status !== 'waiting' && status !== 'pending') {
        return (
            <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.01] p-4 mb-4 text-white/40">
                <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
                    <HelpCircle className="w-4 h-4" />
                    <span>Detalles proporcionados</span>
                </div>
            </div>
        );
    }

    return (
        <div className="border border-purple-500/20 bg-[#0B0B0F]/90 rounded-[20px] p-4.5 mb-4 shadow-xl shadow-black/35 relative overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-full">
            <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

            <div className="flex items-center gap-2 text-purple-400/95 mb-1">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">{request.title || 'Necesito un par de detalles'}</span>
            </div>
            {request.description && (
                <p className="text-xs text-white/50 mb-3.5 leading-relaxed">{request.description}</p>
            )}

            <div className="flex flex-col gap-3">
                {(request.fields || []).map(field => (
                    <div key={field.key} className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                            {field.label}{field.required && <span className="text-purple-400 ml-1">*</span>}
                        </label>

                        {field.type === 'select' ? (
                            <select
                                value={values[field.key] || ''}
                                onChange={e => setField(field.key, e.target.value)}
                                className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.05] transition-all"
                            >
                                <option value="" disabled className="bg-[#0B0B0F]">Selecciona una opción</option>
                                {(field.options || []).map(opt => (
                                    <option key={opt} value={opt} className="bg-[#0B0B0F]">{opt}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                value={values[field.key] ?? ''}
                                onChange={e => setField(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                                placeholder={field.placeholder}
                                className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.05] transition-all"
                            />
                        )}
                    </div>
                ))}
            </div>

            <button
                onClick={() => onSubmit(values)}
                disabled={!isComplete}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mt-4 bg-purple-500 hover:bg-purple-500/90 disabled:bg-white/[0.04] disabled:text-white/30 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.97] disabled:active:scale-100 shadow-md border border-purple-500/30 disabled:border-white/[0.08] disabled:cursor-not-allowed"
            >
                Continuar
                <ArrowRight className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
