'use client';

import React from 'react';
import { Send, Loader2, Camera, Image, FileText, X, Plus, Wrench, Check, Mic, Lock, Sparkles } from 'lucide-react';
import { useChatbot } from './context';
import { useToast } from '@/hooks/use-toast';
import { GlowingOrb, type OrbState } from './glowing-orb';

// One row in the "+" bottom sheet — icon in a rounded box, title + optional
// description stacked, and a trailing indicator on the right (a filled dot
// for the active choice in a mutually-exclusive group like model selection,
// or nothing for a plain action like "upload a file"). Mirrors the native
// action-sheet pattern (icon / title+subtitle / trailing state) instead of
// the cramped single-line dropdown rows this replaced.
function SheetRow({
    icon: Icon,
    title,
    description,
    selected,
    disabled,
    onClick,
}: {
    icon: React.ComponentType<{ className?: string }>
    title: string
    description?: string
    selected?: boolean
    disabled?: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                selected ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.04]'
            }`}
        >
            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${
                selected ? 'bg-primary/10 border-primary/25 text-primary' : 'bg-white/[0.03] border-white/[0.06] text-white/50'
            }`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-semibold ${selected ? 'text-primary' : 'text-white/85'}`}>{title}</p>
                {description && <p className="text-[11px] text-white/35 mt-0.5 leading-snug">{description}</p>}
            </div>
            {/* Only choices in a real selection group (model, toggles) get a
                radio/checkmark — plain one-shot actions like "upload a file"
                have no on/off state to represent, so selected stays
                undefined for those and no indicator renders. */}
            {selected !== undefined && (
                <div className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${
                    selected ? 'border-primary bg-primary' : 'border-white/15'
                }`}>
                    {selected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                </div>
            )}
        </button>
    )
}

// Exported so DesktopHero can render the same suggestions as clickable cards
// under the composer (mirroring MobileHero's chip row, which already existed
// — the desktop empty state had this data available but never rendered it).
export const SUGGESTIONS = [
    'Crear una tarea',
    'Dame ideas',
    'Escribe un texto',
    'Crear un proyecto',
    'Planear un viaje',
    'Ayúdame a elegir',
    'Escribe código Python',
    'Crear una rutina',
];

function FilePreviewItem({ file, onRemove }: { file: File, onRemove: () => void }) {
    const isImage = file.type.startsWith('image/');
    const [preview, setPreview] = React.useState<string>('');

    React.useEffect(() => {
        if (isImage) {
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    }, [file, isImage]);

    return (
        <div className="relative group/file flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            {isImage && preview ? (
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10">
                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                </div>
            ) : (
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                    <FileText className="w-5 h-5 text-primary" />
                </div>
            )}
            <div className="flex flex-col pr-6">
                <span className="text-xs font-medium text-white/90 truncate max-w-[120px]">{file.name}</span>
                <span className="text-[10px] text-white/40">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
            <button
                type="button"
                onClick={onRemove}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover/file:opacity-100 transition-opacity"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}

interface ChatInputProps {
    onSend?: (content: string, files?: File[], webSearchEnabled?: boolean) => Promise<void>;
    disabled?: boolean;
    variant?: 'center' | 'bottom';
}

export function ChatInput({ onSend, disabled, variant = 'bottom' }: ChatInputProps) {
    const {
        sendMessage, isLoading, currentConversationId, createConversation,
        twinMode, setTwinMode, twinModeAvailable,
        selectedModel, setSelectedModel, availableModels,
    } = useChatbot();
    const { toast } = useToast();
    const [input, setInput] = React.useState('');
    const [showMenu, setShowMenu] = React.useState(false);
    const [webSearchEnabled, setWebSearchEnabled] = React.useState(false);
    const [attachedFiles, setAttachedFiles] = React.useState<File[]>([]);
    const [voiceState, setVoiceState] = React.useState<'idle' | 'listening' | 'speaking' | 'thinking' | 'connecting' | 'error'>('idle');

    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const cameraInputRef = React.useRef<HTMLInputElement>(null);
    const photoInputRef = React.useRef<HTMLInputElement>(null);

    // Sync state with central GeminiLiveOrb
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const handleStateChange = (e: any) => {
                const state = e.detail?.state || 'idle';
                setVoiceState(state);
            };
            window.addEventListener('gemini-live-state-change', handleStateChange);
            return () => {
                window.removeEventListener('gemini-live-state-change', handleStateChange);
            };
        }
    }, []);

    // Auto-resize textarea
    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [input]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || disabled) return;

        // Create conversation if none exists (only if using context)
        if (!currentConversationId && !onSend) {
            createConversation();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const message = input;
        const filesToSend = attachedFiles;
        setInput('');
        setAttachedFiles([]);

        if (onSend) {
            await onSend(message, filesToSend, webSearchEnabled);
        } else {
            await sendMessage(message, filesToSend, webSearchEnabled);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Enter to send (without Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as any);
        }
        // Ctrl+Enter to force send even with Shift
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleSubmit(e as any);
        }
        // Escape to stop recording or clear attachments
        if (e.key === 'Escape') {
            if (voiceState === 'listening' || voiceState === 'speaking') {
                window.dispatchEvent(new CustomEvent('toggle-gemini-live'));
            } else if (attachedFiles.length > 0) {
                setAttachedFiles([]);
                toast({
                    title: "Archivos eliminados",
                    description: "Se eliminaron todos los archivos adjuntos",
                });
            } else if (showMenu) {
                setShowMenu(false);
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setAttachedFiles(prev => [...prev, ...files]);
            setShowMenu(false);
            toast({
                title: "Archivos adjuntados",
                description: `${files.length} archivo(s) agregado(s)`,
            });
        }
    };

    const removeFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };


    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const files: File[] = [];

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
                    files.push(file);
                }
            }
        }

        if (files.length > 0) {
            setAttachedFiles(prev => [...prev, ...files]);
            toast({
                title: "Imagen pegada",
                description: `${files.length} imagen(es) agregada(s) desde el portapapeles`,
            });
        }
    };

    return (
        <div className="w-full">
            <div className={`max-w-4xl mx-auto ${variant === 'center' ? 'px-0' : 'px-4'}`}>
                {/* Voice Animation - Centralized Copiloto Voice State */}
                {voiceState !== 'idle' && (
                    <div className="mb-2.5 flex items-center justify-center gap-2.5 text-primary bg-primary/5 border border-primary/10 rounded-full py-1 px-4 pl-2 w-fit mx-auto shadow-sm">
                        <GlowingOrb
                            state={(['listening', 'speaking', 'thinking'].includes(voiceState) ? voiceState : 'thinking') as OrbState}
                            size="sm"
                        />
                        <span className="text-xs font-mono font-bold tracking-wide uppercase">
                            Asistente de Voz: {voiceState === 'listening' ? 'Escuchando' : voiceState === 'speaking' ? 'Hablando' : voiceState === 'thinking' ? 'Procesando' : 'Conectando'}...
                        </span>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="relative group">
                    {/* Attached Files Preview */}
                    {attachedFiles.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2 animate-in fade-in duration-300 px-1">
                            {attachedFiles.map((file, index) => (
                                <FilePreviewItem
                                    key={index}
                                    file={file}
                                    onRemove={() => removeFile(index)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Single row: + / textarea / mic / send. Secondary
                        controls (attach, web search, model, Twin Mode) live
                        in the "+" menu instead of a permanent labeled-pill
                        row — mirrors a plain minimal input bar (a "+", the
                        placeholder, one action button) instead of stacking
                        every control in view at once. */}
                    <div className="flex items-end gap-1 pl-1.5 pr-1.5 py-1.5 rounded-[28px] border border-white/[0.08] bg-white/[0.035] shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-all duration-300 focus-within:border-primary/25 focus-within:bg-white/[0.045]">
                        <button
                            type="button"
                            onClick={() => setShowMenu(!showMenu)}
                            disabled={isLoading || disabled}
                            title="Adjuntar y herramientas"
                            className={`shrink-0 w-9 h-9 mb-0.5 rounded-full flex items-center justify-center border transition-all duration-300 active:scale-95 ${showMenu || webSearchEnabled || (twinModeAvailable && twinMode)
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.06]'
                                }`}
                        >
                            <Plus className={`w-4 h-4 transition-transform duration-300 ${showMenu ? 'rotate-45' : ''}`} />
                        </button>

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder="Escribe tu comando o pregunta aquí..."
                            className="flex-1 bg-transparent text-white/95 placeholder-white/20 outline-none resize-none px-2 py-2 text-[15px] sm:text-sm font-sans leading-relaxed min-h-[2.25rem] max-h-40 focus:ring-0 focus:outline-none focus-visible:ring-0"
                            rows={1}
                            disabled={isLoading || disabled}
                        />

                        {/* Voice */}
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('toggle-gemini-live'))}
                            disabled={isLoading || disabled}
                            className={`shrink-0 w-9 h-9 mb-0.5 rounded-full flex items-center justify-center border transition-all duration-300 active:scale-95 ${voiceState !== 'idle'
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.06]'
                                }`}
                            title="Asistente de voz"
                        >
                            <Mic className="w-4 h-4" />
                        </button>

                        {/* Send Button */}
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading || disabled}
                            className="shrink-0 w-9 h-9 mb-0.5 bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-white/20 disabled:shadow-none text-black rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]"
                            title="Enviar"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-black" />
                            ) : (
                                <Send className="w-3.5 h-3.5 text-black fill-current stroke-[2.5]" />
                            )}
                        </button>
                    </div>

                    {/* "+" menu: on mobile a real bottom-sheet (drag handle,
                        slides up from the viewport edge) — on desktop that
                        same "floats centered mid-screen" treatment read as
                        disconnected from the button that opened it, so ≥sm it
                        anchors directly above the "+" button instead (the
                        `relative` <form> above is the positioning parent),
                        like the original dropdown did, just with the new
                        row design (icon box / title+description / trailing
                        state) instead of the old cramped single-line rows. */}
                    {showMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none animate-in fade-in duration-200"
                                onClick={() => setShowMenu(false)}
                            />
                            <div className="fixed bottom-0 left-0 right-0 z-[201] max-h-[80dvh] overflow-y-auto rounded-t-[28px] border-t border-x border-white/10 bg-[#0a0a0f] shadow-[0_-20px_60px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom duration-300 sm:absolute sm:inset-auto sm:bottom-full sm:left-0 sm:right-auto sm:mb-2 sm:w-[380px] sm:max-h-[70vh] sm:rounded-[28px] sm:border sm:slide-in-from-bottom-2 sm:zoom-in-95">
                                {/* Drag handle — mobile only */}
                                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                                    <div className="w-9 h-1 rounded-full bg-white/15" />
                                </div>

                                {/* Header */}
                                <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-white/[0.06]">
                                    <div>
                                        <h3 className="text-sm font-semibold text-white/90">Herramientas</h3>
                                        <p className="text-[11px] text-white/35">Adjunta archivos o ajusta cómo responde el Twin</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowMenu(false)}
                                        aria-label="Cerrar"
                                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="px-2.5 py-2">
                                    <SheetRow icon={FileText} title="Subir documento" description="PDF, Word o texto" onClick={() => fileInputRef.current?.click()} />
                                    <SheetRow icon={Image} title="Subir imagen" description="JPG, PNG o captura" onClick={() => photoInputRef.current?.click()} />
                                    <SheetRow icon={Camera} title="Tomar foto" description="Usa la cámara del dispositivo" onClick={() => cameraInputRef.current?.click()} />

                                    <div className="my-1.5 mx-3 h-px bg-white/[0.06]" />

                                    <SheetRow
                                        icon={Wrench}
                                        title="Búsqueda web"
                                        description={webSearchEnabled ? 'Activada — el Twin busca en internet' : 'Usa solo su conocimiento interno'}
                                        selected={webSearchEnabled}
                                        onClick={() => {
                                            setWebSearchEnabled(!webSearchEnabled);
                                            toast({
                                                title: !webSearchEnabled ? "Búsqueda Web Activada" : "Búsqueda Web Desactivada",
                                                description: !webSearchEnabled ? "La IA buscará información en internet." : "La IA usará solo su conocimiento interno.",
                                            });
                                        }}
                                    />

                                    <div className="my-1.5 mx-3 h-px bg-white/[0.06]" />

                                    <p className="px-3.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/25">Modelo</p>
                                    {availableModels.map(model => (
                                        <SheetRow
                                            key={model.id}
                                            icon={Sparkles}
                                            title={model.name}
                                            description={model.description}
                                            selected={selectedModel === model.id}
                                            disabled={!model.enabled}
                                            onClick={() => setSelectedModel(model.id)}
                                        />
                                    ))}

                                    <div className="my-1.5 mx-3 h-px bg-white/[0.06]" />

                                    <SheetRow
                                        icon={twinModeAvailable ? Sparkles : Lock}
                                        title={twinModeAvailable ? 'Modo Twin' : 'Modo Twin (Pro)'}
                                        description={twinModeAvailable ? 'Usa tu perfil cognitivo completo para responder' : 'Desbloquea con Novo Pro'}
                                        selected={twinModeAvailable ? twinMode : undefined}
                                        onClick={() => {
                                            if (!twinModeAvailable) {
                                                fetch('/api/billing/checkout', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ interval: 'month' }),
                                                })
                                                    .then(res => res.json())
                                                    .then(data => { if (data.url) window.location.href = data.url; })
                                                return
                                            }
                                            setTwinMode(!twinMode)
                                        }}
                                    />
                                </div>

                                {/* Safe-area padding for iOS home-indicator, mobile only */}
                                <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />
                            </div>
                        </>
                    )}

                    {/* Hidden file inputs */}
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
                    <input ref={photoInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                    <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
                </form>
            </div>
        </div>
    );
}
