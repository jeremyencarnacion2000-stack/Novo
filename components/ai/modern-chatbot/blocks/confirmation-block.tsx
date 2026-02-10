import React from 'react';
import { Check, X, AlertTriangle, ListTodo, Calendar, StickyNote } from 'lucide-react';

interface ConfirmationBlockProps {
    onConfirm: () => void;
    onCancel: () => void;
    status: 'waiting' | 'confirmed' | 'cancelled' | 'pending';
    action?: any;
}

export function ConfirmationBlock({ onConfirm, onCancel, status, action }: ConfirmationBlockProps) {
    if (status !== 'waiting' && status !== 'pending') {
        return (
            <div className={`flex items-center gap-2 text-sm font-medium ${status === 'confirmed' ? 'text-green-500' : 'text-red-500'
                } mb-2`}>
                {status === 'confirmed' ? (
                    <>
                        <Check className="w-4 h-4" />
                        <span>Confirmed</span>
                    </>
                ) : (
                    <>
                        <X className="w-4 h-4" />
                        <span>Cancelled</span>
                    </>
                )}
            </div>
        );
    }

    const renderActionDetails = () => {
        if (!action) return null;

        const type = action.name || action.type;
        const payload = action.payload || {};

        switch (type) {
            case 'CREATE_TASK':
                return (
                    <div className="flex items-center gap-2 text-sm text-white/70 mb-3 bg-white/5 p-2 rounded-md border border-white/10">
                        <ListTodo className="w-4 h-4 text-indigo-400" />
                        <span className="font-medium">Crear Tarea:</span>
                        <span className="text-white">{payload.title}</span>
                    </div>
                );
            case 'CREATE_ROUTINE':
                return (
                    <div className="flex items-center gap-2 text-sm text-white/70 mb-3 bg-white/5 p-2 rounded-md border border-white/10">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        <span className="font-medium">Crear Rutina:</span>
                        <span className="text-white">{payload.name}</span>
                    </div>
                );
            case 'CREATE_NOTE':
                return (
                    <div className="flex items-center gap-2 text-sm text-white/70 mb-3 bg-white/5 p-2 rounded-md border border-white/10">
                        <StickyNote className="w-4 h-4 text-indigo-400" />
                        <span className="font-medium">Crear Nota:</span>
                        <span className="text-white">{payload.title}</span>
                    </div>
                );
            case 'CREATE_TASKS':
                return (
                    <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2 text-sm text-white/70">
                            <ListTodo className="w-4 h-4 text-indigo-400" />
                            <span className="font-medium">Crear {payload.tasks?.length || 0} Tareas:</span>
                        </div>
                        <div className="pl-6 space-y-1">
                            {payload.tasks?.slice(0, 5).map((t: any, i: number) => (
                                <div key={i} className="text-xs text-white/60">• {t.title}</div>
                            ))}
                            {payload.tasks?.length > 5 && (
                                <div className="text-xs text-white/40 italic">... y {payload.tasks.length - 5} más</div>
                            )}
                        </div>
                    </div>
                );
            case 'CREATE_PROJECT':
                return (
                    <div className="flex items-center gap-2 text-sm text-white/70 mb-3 bg-white/5 p-2 rounded-md border border-white/10">
                        <ListTodo className="w-4 h-4 text-indigo-400" />
                        <span className="font-medium">Crear Proyecto:</span>
                        <span className="text-white">{payload.title}</span>
                    </div>
                );
            case 'CREATE_COURSE':
                return (
                    <div className="flex items-center gap-2 text-sm text-white/70 mb-3 bg-white/5 p-2 rounded-md border border-white/10">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        <span className="font-medium">Crear Curso:</span>
                        <span className="text-white">{payload.name}</span>
                    </div>
                );
            case 'ADD_GRADE':
                return (
                    <div className="flex items-center gap-2 text-sm text-white/70 mb-3 bg-white/5 p-2 rounded-md border border-white/10">
                        <Check className="w-4 h-4 text-indigo-400" />
                        <span className="font-medium">Añadir Nota:</span>
                        <span className="text-white">{payload.name} ({payload.score}/{payload.maxScore})</span>
                    </div>
                );
            default:
                return (
                    <div className="text-xs text-white/40 mb-3 italic">
                        Acción: {type}
                    </div>
                );
        }
    };

    return (
        <div className="border border-indigo-500/30 bg-indigo-500/5 rounded-xl p-4 mb-4 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-2 text-indigo-400 mb-3">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold tracking-widest uppercase">Confirmación Requerida</span>
            </div>

            {renderActionDetails()}

            <div className="flex gap-3">
                <button
                    onClick={onConfirm}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                >
                    <Check className="w-4 h-4" />
                    Confirmar
                </button>
                <button
                    onClick={onCancel}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm font-bold transition-all active:scale-95 border border-white/10"
                >
                    <X className="w-4 h-4" />
                    Cancelar
                </button>
            </div>
        </div>
    );
}
