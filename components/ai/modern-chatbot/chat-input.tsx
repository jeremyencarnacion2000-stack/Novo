'use client';

import React from 'react';
import { Send, Paperclip, Mic, MicOff, Loader2, Camera, Image, FileText, X, Globe } from 'lucide-react';
import { useChatbot } from './context';
import { useToast } from '@/hooks/use-toast';

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

export function ChatInput() {
    const { sendMessage, isLoading, currentConversationId, createConversation } = useChatbot();
    const { toast } = useToast();
    const [input, setInput] = React.useState('');
    const [showAttachments, setShowAttachments] = React.useState(false);
    const [isRecording, setIsRecording] = React.useState(false);
    const [webSearchEnabled, setWebSearchEnabled] = React.useState(false);
    const [showVoiceAnimation, setShowVoiceAnimation] = React.useState(false);
    const [attachedFiles, setAttachedFiles] = React.useState<File[]>([]);
    const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
    const [recordingTime, setRecordingTime] = React.useState(0);

    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const cameraInputRef = React.useRef<HTMLInputElement>(null);
    const photoInputRef = React.useRef<HTMLInputElement>(null);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);
    const recordingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

    // Auto-resize textarea
    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [input]);

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        // Create conversation if none exists
        if (!currentConversationId) {
            createConversation();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const message = input;
        setInput('');
        setAttachedFiles([]);
        setAudioBlob(null);

        await sendMessage(message);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as any);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setInput(suggestion);
        textareaRef.current?.focus();
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

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(audioBlob);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());

                // Transcribe audio automatically
                toast({
                    title: "Transcribiendo audio...",
                    description: "Un momento por favor",
                });

                try {
                    const formData = new FormData();
                    formData.append('audio', audioBlob);

                    const response = await fetch('/api/ai/transcribe', {
                        method: 'POST',
                        body: formData,
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.text) {
                            setInput(prev => prev + (prev ? ' ' : '') + data.text);
                            toast({
                                title: "¡Transcripción completada!",
                                description: `Texto agregado al chat`,
                            });
                            textareaRef.current?.focus();
                        }
                    } else {
                        throw new Error('Error en la transcripción');
                    }
                } catch (error) {
                    console.error('Transcription error:', error);
                    toast({
                        title: "Error de transcripción",
                        description: "No se pudo transcribir el audio. Intenta de nuevo.",
                        variant: "destructive"
                    });
                }

                setRecordingTime(0);
                if (recordingIntervalRef.current) {
                    clearInterval(recordingIntervalRef.current);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setShowVoiceAnimation(true);

            // Start timer
            setRecordingTime(0);
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            toast({
                title: "Grabando audio",
                description: "Presiona el micrófono nuevamente para detener",
            });
        } catch (error) {
            console.error('Error starting recording:', error);
            toast({
                title: "Error de permisos",
                description: "No se pudo acceder al micrófono. Verifica los permisos del navegador.",
                variant: "destructive"
            });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setShowVoiceAnimation(false);
        }
    };

    const toggleVoiceRecording = () => {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    };

    return (
        <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-6 px-6">
            <div className="max-w-4xl mx-auto">
                {/* Suggestions Marquee */}
                {!showVoiceAnimation && (
                    <div className="mb-4 overflow-hidden relative">
                        <div className="flex gap-3 animate-marquee hover:[animation-play-state:paused]">
                            {/* Duplicate for seamless loop */}
                            {[...SUGGESTIONS, ...SUGGESTIONS].map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="flex-shrink-0 px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95 border border-border"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                        {/* Gradient masks */}
                        <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background to-transparent pointer-events-none" />
                        <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background to-transparent pointer-events-none" />
                    </div>
                )}

                {/* Voice Animation */}
                {showVoiceAnimation && (
                    <div className="mb-4 flex flex-col items-center gap-2">
                        <div className={`w-32 h-32 rounded-full bg-destructive/20 flex items-center justify-center ${isRecording ? 'animate-pulse' : ''}`}>
                            <div className="w-24 h-24 rounded-full bg-destructive/40 flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center">
                                    {isRecording ? (
                                        <MicOff className="w-8 h-8 text-destructive-foreground" />
                                    ) : (
                                        <Mic className="w-8 h-8 text-destructive-foreground" />
                                    )}
                                </div>
                            </div>
                        </div>
                        {isRecording && (
                            <div className="text-destructive font-mono text-lg font-bold">
                                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                            </div>
                        )}
                    </div>
                )}

                {/* Attached Files Preview */}
                {attachedFiles.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                        {attachedFiles.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-sm"
                            >
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-foreground truncate max-w-[150px]">{file.name}</span>
                                <button
                                    onClick={() => removeFile(index)}
                                    className="p-0.5 hover:bg-accent rounded transition-colors"
                                >
                                    <X className="w-3 h-3 text-muted-foreground" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="relative">
                    <div className="relative flex items-end gap-2 bg-secondary border-2 border-input rounded-2xl p-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring transition-all">
                        {/* Textarea */}
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe tu mensaje..."
                            className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none resize-none px-3 py-2 max-h-40 min-h-[2.5rem]"
                            rows={1}
                            disabled={isLoading || showVoiceAnimation}
                        />

                        {/* Button Bar */}
                        <div className="flex items-center gap-2 pb-2">
                            {/* Left buttons */}
                            <div className="flex items-center gap-1">
                                {/* Attachment Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setShowAttachments(!showAttachments)}
                                    className={`p-2 hover:bg-accent rounded-lg transition-colors ${showAttachments ? 'bg-accent' : ''}`}
                                    title="Adjuntar"
                                    disabled={isLoading}
                                >
                                    <Paperclip className={`w-5 h-5 ${showAttachments ? 'text-primary' : 'text-muted-foreground'}`} />
                                </button>

                                {/* Web Search Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                                    className={`p-2 hover:bg-accent rounded-lg transition-colors ${webSearchEnabled ? 'bg-accent border-2 border-blue-500' : ''}`}
                                    title={webSearchEnabled ? 'Búsqueda web activada' : 'Activar búsqueda web'}
                                    disabled={isLoading}
                                >
                                    <Globe className={`w-5 h-5 ${webSearchEnabled ? 'text-blue-500' : 'text-muted-foreground'}`} />
                                </button>
                            </div>

                            {/* Right buttons */}
                            <div className="flex items-center gap-1">
                                {/* Voice Recording */}
                                <button
                                    type="button"
                                    onClick={toggleVoiceRecording}
                                    className={`p-2 rounded-lg transition-all ${isRecording
                                        ? 'bg-destructive/20 hover:bg-destructive/30'
                                        : 'hover:bg-accent'
                                        }`}
                                    title={isRecording ? 'Detener grabación' : 'Grabar voz'}
                                    disabled={isLoading}
                                >
                                    {isRecording ? (
                                        <MicOff className="w-5 h-5 text-destructive animate-pulse" />
                                    ) : (
                                        <Mic className="w-5 h-5 text-muted-foreground" />
                                    )}
                                </button>

                                {/* Send Button */}
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading || showVoiceAnimation}
                                    className="p-2 bg-primary hover:bg-primary/90 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 active:scale-95"
                                    title="Enviar mensaje"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
                                    ) : (
                                        <Send className="w-5 h-5 text-primary-foreground" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Attachments Popup */}
                    {showAttachments && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
                                onClick={() => setShowAttachments(false)}
                            />

                            {/* Popup */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-3 bg-card/95 backdrop-blur-md border border-border rounded-2xl p-4 shadow-2xl z-50 animate-in slide-in-from-bottom-2 duration-200">
                                {/* Close button */}
                                <button
                                    onClick={() => setShowAttachments(false)}
                                    className="p-3 bg-destructive hover:bg-destructive/90 rounded-full transition-all hover:scale-110 active:scale-95"
                                >
                                    <X className="w-6 h-6 text-destructive-foreground" />
                                </button>

                                {/* Camera */}
                                <button
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="p-3 bg-primary hover:bg-primary/90 rounded-full transition-all hover:scale-110 active:scale-95"
                                    title="Tomar foto"
                                >
                                    <Camera className="w-6 h-6 text-primary-foreground" />
                                </button>

                                {/* Photos */}
                                <button
                                    onClick={() => photoInputRef.current?.click()}
                                    className="p-3 bg-primary hover:bg-primary/90 rounded-full transition-all hover:scale-110 active:scale-95"
                                    title="Seleccionar imagen"
                                >
                                    <Image className="w-6 h-6 text-primary-foreground" />
                                </button>

                                {/* Files */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-3 bg-primary hover:bg-primary/90 rounded-full transition-all hover:scale-110 active:scale-95"
                                    title="Seleccionar archivo"
                                >
                                    <FileText className="w-6 h-6 text-primary-foreground" />
                                </button>
                            </div>
                        </>
                    )}

                    {/* Hidden file inputs */}
                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {/* Character count */}
                    {input.length > 0 && !showVoiceAnimation && (
                        <div className="absolute -bottom-6 right-0 text-xs text-muted-foreground flex items-center gap-2">
                            {webSearchEnabled && (
                                <span className="text-blue-500 flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    Web
                                </span>
                            )}
                            <span>{input.length} caracteres</span>
                        </div>
                    )}
                </form>

                {/* Voice recording hint */}
                {showVoiceAnimation && (
                    <div className="text-center mt-4 text-sm text-muted-foreground animate-pulse">
                        {isRecording ? 'Grabando... Toca el micrófono para detener' : 'Preparando grabación...'}
                    </div>
                )}
            </div>

            <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
        </div>
    );
}
