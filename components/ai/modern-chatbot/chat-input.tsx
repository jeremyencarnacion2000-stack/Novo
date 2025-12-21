'use client';

import React from 'react';
import { Send, Paperclip, Mic, MicOff, Loader2, Camera, Image, FileText, X, Globe, Code } from 'lucide-react';
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
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <FileText className="w-5 h-5 text-indigo-400" />
                </div>
            )}
            <div className="flex flex-col pr-6">
                <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{file.name}</span>
                <span className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
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
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
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
        setAudioBlob(null);

        if (onSend) {
            await onSend(message, filesToSend, webSearchEnabled);
        } else {
            await sendMessage(message, filesToSend, webSearchEnabled);
        }
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

    // Web Speech API recognition reference
    const recognitionRef = React.useRef<any>(null);

    const startRecording = async () => {
        // Try to use Web Speech API first (free, no API key needed)
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (SpeechRecognition) {
            try {
                const recognition = new SpeechRecognition();
                recognition.lang = 'es-ES';
                recognition.continuous = true;
                recognition.interimResults = true;

                recognitionRef.current = recognition;
                let finalTranscript = '';

                recognition.onstart = () => {
                    setIsRecording(true);
                    setShowVoiceAnimation(true);
                    setRecordingTime(0);
                    recordingIntervalRef.current = setInterval(() => {
                        setRecordingTime(prev => prev + 1);
                    }, 1000);
                    toast({
                        title: "🎤 Grabando...",
                        description: "Habla ahora. Presiona el micrófono para detener.",
                    });
                };

                recognition.onresult = (event: any) => {
                    let interimTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript + ' ';
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }
                    // Show interim results
                    if (interimTranscript) {
                        setInput(prev => finalTranscript + interimTranscript);
                    }
                };

                recognition.onend = () => {
                    setIsRecording(false);
                    setShowVoiceAnimation(false);
                    if (recordingIntervalRef.current) {
                        clearInterval(recordingIntervalRef.current);
                    }
                    if (finalTranscript.trim()) {
                        setInput(finalTranscript.trim());
                        toast({
                            title: "✅ Transcripción completada",
                            description: "El texto ha sido agregado.",
                        });
                        textareaRef.current?.focus();
                    }
                };

                recognition.onerror = (event: any) => {
                    console.error('Speech recognition error:', event.error);
                    setIsRecording(false);
                    setShowVoiceAnimation(false);
                    if (recordingIntervalRef.current) {
                        clearInterval(recordingIntervalRef.current);
                    }
                    toast({
                        title: "Error de reconocimiento",
                        description: event.error === 'not-allowed'
                            ? "Permisos de micrófono denegados."
                            : "No se pudo reconocer el audio.",
                        variant: "destructive"
                    });
                };

                recognition.start();
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                toast({
                    title: "Error",
                    description: "No se pudo iniciar el reconocimiento de voz.",
                    variant: "destructive"
                });
            }
        } else {
            // Fallback to MediaRecorder + API if Web Speech not available
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
                    stream.getTracks().forEach(track => track.stop());

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
                                    description: "Texto agregado al chat",
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
                            description: "No se pudo transcribir el audio.",
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
        }
    };

    const stopRecording = () => {
        // Stop Web Speech API if active
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        // Stop MediaRecorder if active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setShowVoiceAnimation(false);
    };

    const toggleVoiceRecording = () => {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    };

    return (
        <div className="w-full">
            <div className="max-w-4xl mx-auto">
                {/* Voice Animation - Minimal */}
                {showVoiceAnimation && (
                    <div className="mb-2 flex items-center justify-center gap-2 text-destructive animate-pulse">
                        <Mic className="w-4 h-4" />
                        <span className="text-xs font-mono font-bold">
                            RECORDING {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                        </span>
                    </div>
                )}
                {/* Attached Files Preview */}
                {attachedFiles.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-3">
                        {attachedFiles.map((file, index) => (
                            <FilePreviewItem
                                key={index}
                                file={file}
                                onRemove={() => removeFile(index)}
                            />
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="relative group">
                    <div className="relative flex items-center gap-2 bg-secondary/30 border border-input rounded-lg p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm">

                        {/* Command Icon */}
                        <div className="pl-2 text-muted-foreground">
                            <Code className="w-4 h-4" />
                        </div>

                        {/* Textarea */}
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a command or ask a question..."
                            className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none resize-none px-2 py-2 max-h-40 min-h-[2.5rem] text-sm font-mono leading-relaxed"
                            rows={1}
                            disabled={isLoading || showVoiceAnimation || disabled}
                        />

                        {/* Right Actions */}
                        <div className="flex items-center gap-1 pr-1">
                            {/* Attachment Toggle */}
                            <button
                                type="button"
                                onClick={() => setShowAttachments(!showAttachments)}
                                className={`p-1.5 hover:bg-accent rounded-md transition-colors ${showAttachments ? 'bg-accent text-primary' : 'text-muted-foreground'}`}
                                title="Attach files"
                                disabled={isLoading || disabled}
                            >
                                <Paperclip className="w-4 h-4" />
                            </button>

                            {/* Web Search Toggle */}
                            <button
                                type="button"
                                onClick={() => {
                                    setWebSearchEnabled(!webSearchEnabled);
                                    toast({
                                        title: !webSearchEnabled ? "Búsqueda Web Activada" : "Búsqueda Web Desactivada",
                                        description: !webSearchEnabled ? "La IA buscará información en internet." : "La IA usará solo su conocimiento interno.",
                                    });
                                }}
                                className={`p-1.5 rounded-md transition-colors ${webSearchEnabled ? 'bg-blue-500/10 text-blue-500' : 'text-muted-foreground hover:bg-accent'}`}
                                title="Web Search"
                                disabled={isLoading || disabled}
                            >
                                <Globe className="w-4 h-4" />
                            </button>

                            {/* Voice Recording */}
                            <button
                                type="button"
                                onClick={toggleVoiceRecording}
                                className={`p-1.5 rounded-md transition-all ${isRecording
                                    ? 'bg-destructive/20 text-destructive'
                                    : 'hover:bg-accent text-muted-foreground'
                                    }`}
                                title={isRecording ? 'Stop recording' : 'Start recording'}
                                disabled={isLoading || disabled}
                            >
                                {isRecording ? (
                                    <MicOff className="w-4 h-4" />
                                ) : (
                                    <Mic className="w-4 h-4" />
                                )}
                            </button>

                            {/* Send Button */}
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading || showVoiceAnimation || disabled}
                                className="p-1.5 bg-primary text-primary-foreground rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 ml-1"
                                title="Execute"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Attachments Popup */}
                    {showAttachments && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowAttachments(false)}
                            />
                            <div className="absolute bottom-full right-0 mb-2 flex flex-col gap-1 bg-popover border border-border rounded-lg p-1 shadow-lg z-50 min-w-[150px]">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md text-left"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span>Upload File</span>
                                </button>
                                <button
                                    onClick={() => photoInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md text-left"
                                >
                                    <Image className="w-4 h-4" />
                                    <span>Upload Image</span>
                                </button>
                                <button
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md text-left"
                                >
                                    <Camera className="w-4 h-4" />
                                    <span>Take Photo</span>
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
        </div >
    );
}
