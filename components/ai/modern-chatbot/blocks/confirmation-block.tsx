import React from 'react';
import { Check, X, AlertTriangle, ListTodo, Calendar, StickyNote, Play, AlertCircle } from 'lucide-react';

interface ConfirmationBlockProps {
    onConfirm: () => void;
    onCancel: () => void;
    status: 'waiting' | 'confirmed' | 'cancelled' | 'pending';
    action?: any;
}

export function ConfirmationBlock({ onConfirm, onCancel, status, action }: ConfirmationBlockProps) {
    const renderActionDetails = () => {
        if (!action) return null;

        const type = action.name || action.type;
        const payload = action.payload || {};

        const detailItemClass = "flex items-start gap-2.5 text-[13px] text-white/70 mb-3 bg-white/[0.03] p-3 rounded-lg border border-white/[0.06] shadow-inner min-w-0 w-full";

        switch (type) {
            case 'CREATE_TASK':
                return (
                    <div className={detailItemClass}>
                        <ListTodo className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <span className="font-semibold text-white/40 block text-[10px] uppercase tracking-wider mb-0.5">Crear Tarea</span>
                            <span className="text-white/90 break-words font-medium text-sm block leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                {payload.title}
                            </span>
                        </div>
                    </div>
                );
            case 'CREATE_ROUTINE':
                return (
                    <div className={detailItemClass}>
                        <Calendar className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <span className="font-semibold text-white/40 block text-[10px] uppercase tracking-wider mb-0.5">Crear Rutina</span>
                            <span className="text-white/90 break-words font-medium text-sm block leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                {payload.name}
                            </span>
                        </div>
                    </div>
                );
            case 'CREATE_NOTE':
                return (
                    <div className={detailItemClass}>
                        <StickyNote className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <span className="font-semibold text-white/40 block text-[10px] uppercase tracking-wider mb-0.5">Crear Nota</span>
                            <span className="text-white/90 break-words font-medium text-sm block leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                {payload.title}
                            </span>
                        </div>
                    </div>
                );
            case 'CREATE_TASKS':
                return (
                    <div className="space-y-2 mb-3 bg-white/[0.03] p-3 rounded-lg border border-white/[0.06] w-full min-w-0">
                        <div className="flex items-center gap-2 text-xs font-semibold text-white/55 uppercase tracking-wider">
                            <ListTodo className="w-4 h-4 text-primary shrink-0" />
                            <span>Crear {payload.tasks?.length || 0} Tareas</span>
                        </div>
                        <div className="pl-6 space-y-1.5 min-w-0">
                            {payload.tasks?.slice(0, 5).map((t: any, i: number) => (
                                <div
                                    key={i}
                                    className="text-xs text-white/70 break-words leading-relaxed"
                                    style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                                >
                                    • {t.title}
                                </div>
                            ))}
                            {payload.tasks?.length > 5 && (
                                <div className="text-[11px] text-white/40 italic pl-2">
                                    ... y {payload.tasks.length - 5} más
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'CREATE_PROJECT':
                return (
                    <div className={detailItemClass}>
                        <ListTodo className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <span className="font-semibold text-white/40 block text-[10px] uppercase tracking-wider mb-0.5">Crear Proyecto</span>
                            <span className="text-white/90 break-words font-medium text-sm block leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                {payload.title}
                            </span>
                        </div>
                    </div>
                );
            case 'CREATE_COURSE':
                return (
                    <div className={detailItemClass}>
                        <Calendar className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <span className="font-semibold text-white/40 block text-[10px] uppercase tracking-wider mb-0.5">Crear Curso</span>
                            <span className="text-white/90 break-words font-medium text-sm block leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                {payload.name}
                            </span>
                        </div>
                    </div>
                );
            case 'ADD_GRADE':
                return (
                    <div className={detailItemClass}>
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <span className="font-semibold text-white/40 block text-[10px] uppercase tracking-wider mb-0.5">Añadir Calificación</span>
                            <span className="text-white/90 break-words font-medium text-sm block leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                {payload.name} ({payload.score}/{payload.maxScore})
                            </span>
                        </div>
                    </div>
                );
            case 'GENERATE_FILE':
                const fileExt = payload.filename?.split('.').pop()?.toUpperCase() || payload.mimeType?.split('/').pop()?.toUpperCase() || 'FILE';
                const displayName = payload.filename || payload.fileName || payload.name || 'Documento';
                const displayMime = payload.mimeType || payload.mime || 'archivo';
                return (
                    <div className="flex items-center gap-3 text-sm text-white/70 mb-3 bg-white/[0.03] p-3 rounded-lg border border-white/[0.06] w-full min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/25 shrink-0 shadow-sm">
                            <span className="text-[10px] font-bold text-primary tracking-wider">{fileExt}</span>
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-medium text-white/90 truncate block text-sm">{displayName}</span>
                            <span className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">{displayMime}</span>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="text-xs text-white/45 mb-3 italic bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04] w-full break-all" style={{ overflowWrap: 'anywhere' }}>
                        Acción: {type}
                    </div>
                );
        }
    };

    if (status !== 'waiting' && status !== 'pending') {
        const isConfirmed = status === 'confirmed';
        return (
            <div className={`rounded-xl border p-4 mb-4 transition-all duration-300 ${
                isConfirmed 
                    ? 'border-emerald-500/20 bg-emerald-500/[0.02] text-emerald-400' 
                    : 'border-white/[0.06] bg-white/[0.01] text-white/40'
            }`}>
                <div className="flex items-center gap-2 text-sm font-semibold tracking-wide mb-2.5">
                    {isConfirmed ? (
                        <>
                            <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <Check className="w-3.5 h-3.5" />
                            </div>
                            <span>Acción confirmada y ejecutada</span>
                        </>
                    ) : (
                        <>
                            <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                <X className="w-3.5 h-3.5" />
                            </div>
                            <span>Operación cancelada</span>
                        </>
                    )}
                </div>
                {isConfirmed && action && (
                    <div className="opacity-45 scale-[0.98] origin-left pointer-events-none transition-all duration-300">
                        {renderActionDetails()}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="border border-primary/20 bg-[#0B0B0F]/90 rounded-2xl p-4.5 mb-4 shadow-xl shadow-black/35 relative overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-full animate-glow-pulse">
            {/* Fine ambient neon glow line at the top */}
            <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary/50 to-transparent hover-glow-border" />
            
            <div className="flex items-center gap-2 text-primary/95 mb-3.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Confirmación Requerida</span>
            </div>

            <div className="min-w-0 w-full overflow-hidden">
                {renderActionDetails()}
            </div>

            <div className="flex gap-3 mt-4">
                <button
                    onClick={onConfirm}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all active:scale-[0.97] hover:shadow-[0_0_15px_rgba(99,102,241,0.25)] shadow-md border border-primary/30"
                >
                    <Check className="w-3.5 h-3.5" />
                    Confirmar
                </button>
                <button
                    onClick={onCancel}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-white/80 rounded-xl text-xs font-bold transition-all active:scale-[0.97] border border-white/[0.08] hover:border-white/15"
                >
                    <X className="w-3.5 h-3.5" />
                    Cancelar
                </button>
            </div>
        </div>
    );
}
