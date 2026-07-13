'use client';

import React from 'react';
import { Send, Plus, Loader2, Camera, Image, FileText, X, Globe } from 'lucide-react';
import { useChatbot } from './context';
import { useToast } from '@/hooks/use-toast';
import { ModelSelector } from './model-selector';
import { GlowingOrb, type OrbState } from './glowing-orb';

const SUGGESTIONS = [
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
    const { sendMessage, isLoading, currentConversationId, createConversation } = useChatbot();
    const { toast } = useToast();
    const [input, setInput] = React.useState('');
    const [showAttachments, setShowAttachments] = React.useState(false);
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
            } else if (showAttachments) {
                setShowAttachments(false);
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setAttachedFiles(prev => [...prev, ...files]);
            setShowAttachments(false);
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
                    {/* No card/border/blur — the composer floats directly on the
                        page background (PulseChat reference: "+", model name as
                        plain text, and a circular send button, nothing else). */}
                    <div className="flex flex-col px-1 py-1 transition-all duration-300">

                        {/* Attached Files Preview */}
                        {attachedFiles.length > 0 && (
                            <div className="mb-2.5 flex flex-wrap gap-2 animate-in fade-in duration-300 px-1 pt-1">
                                {attachedFiles.map((file, index) => (
                                    <FilePreviewItem
                                        key={index}
                                        file={file}
                                        onRemove={() => removeFile(index)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Textarea */}
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder="Escribe tu comando o pregunta aquí..."
                            className="w-full bg-transparent text-white/95 placeholder-white/20 outline-none resize-none px-2 py-2 text-[15px] sm:text-sm font-sans leading-relaxed min-h-[3rem] max-h-40 focus:ring-0 focus:outline-none focus-visible:ring-0"
                            rows={1}
                            disabled={isLoading || disabled}
                        />

                        {/* Accessories row — a single "+" (attachments + web
                            search live in its popup now, see below) and the
                            model name as plain text, matching the reference's
                            minimal "+ · Model · send" row instead of a bank
                            of separate bordered icon buttons. */}
                        <div className="flex items-center justify-between mt-1.5 px-1">
                            {/* Left Controls */}
                            <div className="flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setShowAttachments(!showAttachments)}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all duration-300 ${showAttachments || webSearchEnabled ? 'text-primary' : ''}`}
                                    title="Más opciones"
                                    disabled={isLoading || disabled}
                                >
                                    <Plus className="w-4 h-4" />
                                </button>

                                {/* Model — plain text, no pill/border */}
                                <div className="animate-in fade-in duration-300">
                                    <ModelSelector />
                                </div>
                            </div>

                            {/* Right Controls */}
                            <div className="flex items-center">
                                {/* Send Button */}
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading || disabled}
                                    className="w-9 h-9 bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-white/20 disabled:shadow-none text-black rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]"
                                    title="Enviar"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5 text-black fill-current stroke-[2.5]" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Attachments Popup */}
                    {showAttachments && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowAttachments(false)}
                            />
                            <div className="absolute bottom-full left-0 mb-2 flex flex-col gap-1 bg-[#09090e]/95 border border-white/10 rounded-2xl p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 min-w-[190px] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setWebSearchEnabled(!webSearchEnabled);
                                        toast({
                                            title: !webSearchEnabled ? "Búsqueda Web Activada" : "Búsqueda Web Desactivada",
                                            description: !webSearchEnabled ? "La IA buscará información en internet." : "La IA usará solo su conocimiento interno.",
                                        });
                                    }}
                                    className={`flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-xl text-left transition-colors ${webSearchEnabled ? 'text-primary bg-primary/[0.06]' : 'text-white/70 hover:text-white hover:bg-white/[0.03]'}`}
                                >
                                    <span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Búsqueda web</span>
                                    {webSearchEnabled && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                </button>
                                <div className="h-px bg-white/[0.06] my-0.5" />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/[0.03] rounded-xl text-left transition-colors"
                                >
                                    <FileText className="w-3.5 h-3.5 text-primary/70" />
                                    <span>Subir Documento</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => photoInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/[0.03] rounded-xl text-left transition-colors"
                                >
                                    <Image className="w-3.5 h-3.5 text-primary/70" />
                                    <span>Subir Imagen</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/[0.03] rounded-xl text-left transition-colors"
                                >
                                    <Camera className="w-3.5 h-3.5 text-primary/70" />
                                    <span>Tomar Foto</span>
                                </button>
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
