'use client';

import React, { useState } from 'react';
import { Check, X, AlertTriangle, ListTodo, Calendar, StickyNote, Play, AlertCircle, Activity, Mail, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/lib/i18n';

interface ConfirmationBlockProps {
    onConfirm: () => void;
    onCancel: () => void;
    status: 'waiting' | 'confirmed' | 'cancelled' | 'pending' | 'executing';
    action?: any;
}

export function ConfirmationBlock({ onConfirm, onCancel, status, action }: ConfirmationBlockProps) {
    const [reviewOpen, setReviewOpen] = useState(false);
    const { language } = useTranslation();
    const consentCopy = getConsentCopy(language);
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
            case 'CREATE_EVENT':
                return (
                    <div className={detailItemClass}>
                        <Calendar className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <span className="font-semibold text-white/40 block text-[10px] uppercase tracking-wider mb-0.5">Agendar Evento</span>
                            <span className="text-white/90 break-words font-medium text-sm block leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                {payload.title}
                            </span>
                            {payload.start && (
                                <span className="text-white/40 text-[11px] block mt-1">
                                    {new Date(payload.start).toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>
                );
            case 'CREATE_TRACKER':
                return (
                    <div className={detailItemClass}>
                        <Activity className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <span className="font-semibold text-white/40 block text-[10px] uppercase tracking-wider mb-0.5">Crear Tracker</span>
                            <span className="text-white/90 break-words font-medium text-sm block leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                {payload.name} {payload.goal ? `— meta: ${payload.goal} ${payload.unit || ''}` : ''}
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
            case 'SEND_EMAIL':
                return (
                    <div className={detailItemClass}>
                        <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <span className="font-semibold text-white/40 block text-[10px] uppercase tracking-wider mb-0.5">Enviar Correo</span>
                            <span className="text-white/90 break-words font-medium text-sm block leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                Para: {payload.to}
                            </span>
                            {payload.subject && (
                                <span className="text-white/50 text-[11px] block mt-1 break-words" style={{ overflowWrap: 'anywhere' }}>
                                    Asunto: {payload.subject}
                                </span>
                            )}
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

    if (status === 'executing') {
        return (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-indigo-300/15 bg-indigo-400/[0.045] p-4 text-sm text-indigo-100/80">
                <div className="size-4 animate-spin rounded-full border-2 border-indigo-200/20 border-t-indigo-200" />
                <span>{consentCopy.executing}</span>
            </div>
        );
    }

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
        <div className="border border-primary/20 bg-[var(--popover)]/90 rounded-2xl p-4.5 mb-4 shadow-xl shadow-black/35 relative overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-full animate-glow-pulse">
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
                    onClick={() => setReviewOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all active:scale-[0.97] hover:shadow-[0_0_15px_rgba(99,102,241,0.25)] shadow-md border border-primary/30"
                >
                    <Check className="w-3.5 h-3.5" />
                    {consentCopy.title}
                </button>
                <button
                    onClick={onCancel}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-white/80 rounded-xl text-xs font-bold transition-all active:scale-[0.97] border border-white/[0.08] hover:border-white/15"
                >
                    <X className="w-3.5 h-3.5" />
                    {consentCopy.cancel}
                </button>
            </div>
            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogContent className="max-w-md border-white/[0.12] bg-[#111116]/95 p-0 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.9)] backdrop-blur-3xl">
                    <div className="border-b border-white/[0.08] px-6 pb-5 pt-6">
                        <div className="mb-4 flex size-10 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-200">
                            <ShieldCheck className="size-5" strokeWidth={1.7} />
                        </div>
                        <DialogHeader className="gap-2 text-left">
                            <DialogTitle className="text-left text-xl font-medium tracking-[-0.03em] text-white">{consentCopy.title}</DialogTitle>
                            <DialogDescription className="text-left text-sm leading-relaxed text-white/54">{consentCopy.description}</DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="space-y-3 px-6 py-5">
                        <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4">
                            <p className="text-[10px] font-semibold tracking-[0.13em] text-white/42 uppercase">{consentCopy.change}</p>
                            <p className="mt-1.5 text-sm font-medium leading-relaxed text-white/88">{describeAction(action, consentCopy)}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-300/12 bg-emerald-400/[0.045] p-3 text-xs leading-relaxed text-emerald-50/70">{consentCopy.control}</div>
                    </div>
                    <DialogFooter className="border-t border-white/[0.08] bg-black/10 px-6 py-4 sm:justify-between">
                        <button onClick={() => setReviewOpen(false)} className="h-10 rounded-xl px-3 text-sm font-medium text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white">{consentCopy.back}</button>
                        <button onClick={() => { setReviewOpen(false); onConfirm(); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black transition-[transform,background] duration-150 hover:bg-white/90 active:scale-[0.97]">
                            <Check className="size-4" />{consentCopy.approve}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

type ConsentCopy = { title: string; description: string; change: string; control: string; back: string; cancel: string; approve: string; executing: string; fallback: string }

function getConsentCopy(language: string): ConsentCopy {
    const copy: Record<string, ConsentCopy> = {
        en: { title: 'Review this change', description: 'The Twin only performs the action shown below after your approval.', change: 'WHAT WILL CHANGE', control: 'You stay in control. This action runs once and its result stays visible in the conversation.', back: 'Go back', cancel: 'Cancel', approve: 'Approve and run', executing: 'Running the approved action…', fallback: 'The Twin will perform this requested action.' },
        es: { title: 'Revisa este cambio', description: 'El Gemelo solo realizará la acción mostrada después de tu aprobación.', change: 'QUÉ VA A CAMBIAR', control: 'Tú mantienes el control. Esta acción se ejecuta una sola vez y verás el resultado en la conversación.', back: 'Volver', cancel: 'Cancelar', approve: 'Aprobar y ejecutar', executing: 'Ejecutando la acción aprobada…', fallback: 'El Gemelo realizará esta acción solicitada.' },
        fr: { title: 'Vérifiez ce changement', description: 'Le Jumeau n’effectuera l’action affichée qu’après votre accord.', change: 'CE QUI VA CHANGER', control: 'Vous gardez le contrôle. Cette action ne s’exécute qu’une fois et son résultat reste visible dans la conversation.', back: 'Retour', cancel: 'Annuler', approve: 'Approuver et lancer', executing: 'Exécution de l’action approuvée…', fallback: 'Le Jumeau effectuera cette action demandée.' },
        de: { title: 'Diese Änderung prüfen', description: 'Der Zwilling führt die gezeigte Aktion erst nach deiner Zustimmung aus.', change: 'WAS SICH ÄNDERT', control: 'Du behältst die Kontrolle. Diese Aktion läuft nur einmal und das Ergebnis bleibt im Gespräch sichtbar.', back: 'Zurück', cancel: 'Abbrechen', approve: 'Bestätigen und ausführen', executing: 'Die bestätigte Aktion wird ausgeführt…', fallback: 'Der Zwilling führt diese angeforderte Aktion aus.' },
    };
    return copy[language] || copy.en;
}

function describeAction(action: any, copy: ConsentCopy) {
    const payload = action?.payload || {};
    const type = String(action?.name || action?.type || '').replaceAll('_', ' ').toLowerCase();
    const target = payload.title || payload.name || payload.to || payload.id;
    if (!type) return copy.fallback;
    return target ? `${type.charAt(0).toUpperCase()}${type.slice(1)}: ${target}` : `${type.charAt(0).toUpperCase()}${type.slice(1)}.`;
}
