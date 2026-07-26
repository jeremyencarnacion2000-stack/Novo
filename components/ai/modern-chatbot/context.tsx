'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { ChatbotContextType, Conversation, Message, AIModel, FileAttachment, MessageBlock, Attachment } from './types';
import { splitSseLines, parseFinalSseLine } from '@/lib/ai/sse-buffer';
import { sileo } from '@/lib/sileo-bell';

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export function useChatbot() {
    const context = useContext(ChatbotContext);
    if (!context) {
        throw new Error('useChatbot must be used within ChatbotProvider');
    }
    return context;
}

const STORAGE_KEY = 'modern-chatbot-conversations';
const SIDEBAR_KEY = 'modern-chatbot-sidebar-collapsed';
const MODEL_KEY = 'modern-chatbot-selected-model';
const TWIN_MODE_KEY = 'modern-chatbot-twin-mode';

// The assistant's own reply narrates actions as already done ("He creado tu
// tarea") per the system prompt's "you simply DO things" rule, but the
// generic confirmation card was gating EVERY action — including plain
// creates — behind a manual Confirm click, so the text said "done" while the
// UI still asked "are you sure?". Additive, easily-undone actions execute
// immediately instead (still via the same confirmAction()/execute() path,
// just auto-triggered); anything that mutates or removes existing data still
// waits for an explicit click since a misclassified id there is harder to
// walk back.
const AUTO_EXECUTE_ACTION_TYPES = new Set([
    'CREATE_TASK', 'CREATE_TASKS', 'CREATE_PROJECT', 'CREATE_ROUTINE',
    'CREATE_NOTE', 'CREATE_EVENT', 'CREATE_TRACKER', 'CREATE_COURSE',
    'ADD_GRADE', 'START_WORKOUT', 'FINISH_WORKOUT', 'GENERATE_FILE',
    'UPDATE_COGNITIVE_STATE', 'COGNITIVE_PIPELINE', 'ANALYZE_PROGRESS', 'SYSTEM_QUERY'
]);

export function ChatbotProvider({ children }: { children: React.ReactNode }) {
    const { status: authStatus } = useSession();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [artifactsPanelCollapsed, setArtifactsPanelCollapsed] = useState(true);
    // 'auto' lets the server's intent classifier route each message to the
    // right model (fast Llama 3.3 for chat, Qwen for actual code requests)
    // instead of forcing every message through one fixed model regardless of
    // intent — restores the server's per-message routing for users who never
    // touch the model picker (the vast majority).
    const [selectedModel, setSelectedModel] = useState('auto');
    const [twinMode, setTwinMode] = useState(false);
    const [twinModeAvailable, setTwinModeAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const conversationsRef = React.useRef(conversations);
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const availableModels: AIModel[] = [
        {
            id: 'qwen/qwen3-32b',
            name: 'Qwen 3 Coder',
            provider: 'Qwen',
            description: 'Altamente estable, de alta velocidad y especialista en código. Recomendado.',
            enabled: true
        },
        {
            id: 'llama-3.3-70b-versatile',
            name: 'Cognitive Core',
            provider: 'Llama 3.3 70B',
            description: 'Razonamiento lógico avanzado y conversación general.',
            enabled: true
        },
        {
            id: 'llama-3.1-8b-instant',
            name: 'Fast Engine',
            provider: 'Llama 3.1 8B',
            description: 'Velocidad ultra rápida e ideal para tareas cotidianas.',
            enabled: true
        },
        {
            id: 'llama-3.2-11b-vision-preview',
            name: 'Vision Scout',
            provider: 'Llama 3.2 Vision',
            description: 'Análisis visual y procesamiento de imágenes de forma precisa.',
            enabled: true
        }
    ];

    // Track which conversations are already in the database to avoid noisy 404s
    const persistedRef = React.useRef<Set<string>>(new Set());
    // Set right before setConversations(loadedFromDb) in the load effect below —
    // lets the save effect (keyed on [conversations]) tell "conversations just
    // got replaced by what the DB already has" apart from "the user actually
    // changed something". Without this, loading N conversations immediately
    // re-PUT/POSTs all N of them unchanged (was measured firing 18 individual
    // full-conversation writes on a single mount, ~4s of avoidable network work
    // on every page load, since ChatbotProvider mounts app-wide).
    const justLoadedFromDbRef = React.useRef(false);

    // Load from database on mount. ChatbotProvider mounts app-wide (including
    // public /landing, /auth/* pages), so both fetches below wait for a real
    // session — otherwise every logged-out page load throws two 401s.
    useEffect(() => {
        if (authStatus !== 'authenticated') return;

        async function loadConversations() {
            try {
                const response = await fetch('/api/ai-conversations');
                if (response.ok) {
                    const dbConversations = await response.json();
                    if (dbConversations.length > 0) {
                        const formattedConversations = dbConversations.map((conv: any) => {
                            persistedRef.current.add(conv.id);
                            return {
                                id: conv.id,
                                title: conv.title || 'Nueva conversación',
                                messages: Array.isArray(conv.messages) ? conv.messages.map((m: any) => ({
                                    id: m.id || crypto.randomUUID(),
                                    role: m.role,
                                    content: m.content,
                                    timestamp: m.timestamp || m.createdAt || new Date().toISOString(),
                                    model: m.model || 'grok-beta',
                                    attachments: m.attachments,
                                    blocks: m.blocks
                                })) : [],
                                createdAt: conv.createdAt,
                                updatedAt: conv.updatedAt,
                                model: conv.model || 'grok-beta'
                            };
                        });
                        justLoadedFromDbRef.current = true;
                        setConversations(formattedConversations);
                        setCurrentConversationId(formattedConversations[0].id);
                    }
                }
            } catch (error) {
                console.error('Failed to load conversations from database:', error);
            }
        }
        loadConversations();

        const sidebarState = localStorage.getItem(SIDEBAR_KEY);
        if (sidebarState) {
            setSidebarCollapsed(sidebarState === 'true');
        }

        const storedModel = localStorage.getItem(MODEL_KEY);
        if (storedModel) {
            let mappedModel = storedModel;
            if (mappedModel === 'qwen-2.5-coder-32b' || mappedModel === 'qwen3-32b' || mappedModel === 'openai/gpt-oss-120b') {
                mappedModel = 'qwen/qwen3-32b';
            } else if (mappedModel === 'meta-llama/llama-4-scout-17b-16e-instruct') {
                mappedModel = 'llama-3.2-11b-vision-preview';
            }

            // Ensure it is one of the available models
            const isValid = ['qwen/qwen3-32b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.2-11b-vision-preview'].includes(mappedModel);
            const finalModel = isValid ? mappedModel : 'qwen/qwen3-32b';
            
            setSelectedModel(finalModel);
            localStorage.setItem(MODEL_KEY, finalModel);
        }

        // Read before the "Save Twin Mode preference" effect below can run —
        // that effect fires synchronously on mount (twinMode starts false)
        // and writes "false" to this same key, so reading it lazily inside
        // this .then() always saw "false" instead of the true first-run
        // null, meaning Pro's "default on" branch could never fire.
        const storedTwinModeAtMount = localStorage.getItem(TWIN_MODE_KEY);
        fetch('/api/billing/status')
            .then(r => r.ok ? r.json() : null)
            .then(status => {
                const isPro = status?.plan === 'pro';
                setTwinModeAvailable(isPro);

                if (storedTwinModeAtMount !== null) {
                    // Respect an explicit prior choice, but never let a
                    // stale "true" survive a plan downgrade.
                    setTwinMode(isPro && storedTwinModeAtMount === 'true');
                } else {
                    // First run: Pro defaults on (immediate value
                    // demonstration), Free defaults off (locked anyway).
                    setTwinMode(isPro);
                }
            })
            .catch(() => {});
    }, [authStatus]);

    // Track which conversations are currently being saved to avoid duplicates
    const savingRef = React.useRef<Set<string>>(new Set());

    // Save conversations to database when they change
    useEffect(() => {
        async function saveToDatabase() {
            if (justLoadedFromDbRef.current) {
                // This run was triggered by loading conversations from the DB,
                // not a real edit — they're already persisted as-is.
                justLoadedFromDbRef.current = false;
                return;
            }
            if (conversations.length === 0) return;

            const conversationsToSave = conversations.filter(conv => {
                // Only save if it has messages or a non-default title
                return conv.messages.length > 0 || conv.title !== 'Nueva conversación';
            });

            for (const conv of conversationsToSave) {
                if (savingRef.current.has(conv.id)) continue;

                try {
                    savingRef.current.add(conv.id);

                    const cleanId = conv.id.replace(/\/$/, '');
                    const isPersisted = persistedRef.current.has(cleanId);

                    if (isPersisted) {
                        // Update existing
                        await fetch(`/api/ai-conversations/${cleanId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                title: conv.title,
                                messages: conv.messages,
                                model: conv.model
                            })
                        });
                    } else {
                        // Create new
                        const response = await fetch('/api/ai-conversations', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: cleanId,
                                title: conv.title,
                                messages: conv.messages,
                                model: conv.model
                            })
                        });
                        if (response.ok) {
                            persistedRef.current.add(cleanId);
                        }
                    }
                } catch (error) {
                    console.error('Failed to save conversation to database:', error);
                } finally {
                    savingRef.current.delete(conv.id);
                }
            }
        }

        const timeoutId = setTimeout(saveToDatabase, 2000); // Increased delay to reduce noise
        return () => clearTimeout(timeoutId);
    }, [conversations]);

    // Save sidebar state
    useEffect(() => {
        localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.toString());
    }, [sidebarCollapsed]);

    // Save model selection
    useEffect(() => {
        localStorage.setItem(MODEL_KEY, selectedModel);
    }, [selectedModel]);

    // Save Twin Mode preference
    useEffect(() => {
        localStorage.setItem(TWIN_MODE_KEY, twinMode.toString());
    }, [twinMode]);

    const currentConversation = conversations.find(c => c.id === currentConversationId);
    const messages = currentConversation?.messages || [];

    const createConversation = useCallback(() => {
        const newConv: Conversation = {
            id: crypto.randomUUID(),
            title: 'Nueva conversación',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            model: selectedModel
        };
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationId(newConv.id);
    }, [selectedModel]);

    const deleteConversation = useCallback(async (id: string) => {
        const previousConversationId = currentConversationId;
        let removedConversation: Conversation | undefined;
        let removedIndex = -1;

        setConversations(prev => {
            removedIndex = prev.findIndex(c => c.id === id);
            removedConversation = prev[removedIndex];
            const filtered = prev.filter(c => c.id !== id);
            if (currentConversationId === id && filtered.length > 0) {
                setCurrentConversationId(filtered[0].id);
            } else if (filtered.length === 0) {
                setCurrentConversationId(null);
            }
            return filtered;
        });

        // Only the server knows whether this conversation was ever actually
        // persisted — deleting one that isn't (204/404 either way here since
        // the route 404s on no match) is a legitimate no-op, but a real
        // failure (500/network) must roll the optimistic removal back.
        // Without this, a failed server-side delete left the UI showing
        // "gone" while the row still existed in the DB — it just reappeared
        // on the next reload with no explanation.
        try {
            const response = await fetch(`/api/ai-conversations/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok && response.status !== 404 && removedConversation) {
                throw new Error(`Delete failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            if (removedConversation) {
                const restored = removedConversation;
                setConversations(prev => {
                    const next = [...prev];
                    next.splice(Math.min(removedIndex, next.length), 0, restored);
                    return next;
                });
                setCurrentConversationId(previousConversationId);
            }
            sileo.error({ title: 'Could not delete conversation', description: 'Please try again.' });
        }
    }, [currentConversationId]);

    const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
        setConversations(prev => prev.map(c =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        ));
    }, []);

    const sendMessage = useCallback(async (content: string, files?: File[], webSearchEnabled?: boolean) => {
        if (!content.trim()) return;

        // Auto-create a conversation if none is active
        let activeConversationId = currentConversationId;
        if (!activeConversationId) {
            const newConv: Conversation = {
                id: crypto.randomUUID(),
                title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
                messages: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                model: selectedModel
            };
            setConversations(prev => [newConv, ...prev]);
            setCurrentConversationId(newConv.id);
            activeConversationId = newConv.id;
        }

        // Convert files to attachments for persistence
        let messageAttachments: Attachment[] = [];
        let documentContext = '';

        const compressImage = (base64Str: string, maxWidth = 1200, maxHeight = 1200, quality = 0.7): Promise<string> => {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = base64Str;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
            });
        };

        if (files && files.length > 0) {
            messageAttachments = await Promise.all(
                files.map(async (file) => {
                    const isImage = file.type.startsWith('image/');
                    const isDocument = file.name.match(/\.(pdf|docx|txt|md)$/i);

                    // For documents, parse and extract text
                    if (isDocument && !isImage) {
                        try {
                            const formData = new FormData();
                            formData.append('file', file);
                            const parseResponse = await fetch('/api/ai/parse-document', {
                                method: 'POST',
                                body: formData
                            });
                            if (parseResponse.ok) {
                                const parseData = await parseResponse.json();
                                if (parseData.content) {
                                    documentContext += `\n\n[DOCUMENT: ${file.name}]\n${parseData.content}\n[END OF DOCUMENT]`;
                                }
                            }
                        } catch (e) {
                            console.error('Failed to parse document:', e);
                        }
                    }

                    // Create attachment for display
                    return new Promise<Attachment>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = async () => {
                            let url = reader.result as string;
                            if (isImage) {
                                try {
                                    url = await compressImage(url);
                                } catch (e) {
                                    console.error('Failed to compress image:', e);
                                }
                            }
                            resolve({
                                id: crypto.randomUUID(),
                                name: file.name,
                                type: isImage ? 'image/jpeg' : file.type,
                                url: url,
                                size: file.size
                            });
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                })
            );
        }

        // Append document context to message if present
        const processedContent = documentContext
            ? content.trim() + documentContext
            : content.trim();

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date().toISOString(),
            model: selectedModel,
            attachments: messageAttachments.length > 0 ? messageAttachments : undefined
        };

        // Add user message using functional update to ensure we have latest state
        setConversations(prev => prev.map(c =>
            c.id === activeConversationId
                ? {
                    ...c,
                    messages: [...c.messages, userMessage],
                    title: c.messages.length === 0 ? (content.slice(0, 50) + (content.length > 50 ? '...' : '')) : c.title,
                    updatedAt: new Date().toISOString()
                }
                : c
        ));

        setIsLoading(true);
        setIsTyping(true);
        setError(null);

        let status = 'Thinking...';
        const lowerContent = content.toLowerCase();
        if (webSearchEnabled) {
            status = 'Searching the web...';
        } else if (lowerContent.includes('crea') || lowerContent.includes('genera') || lowerContent.includes('escribe') || lowerContent.includes('haz')) {
            status = 'Creating content...';
        } else if (lowerContent.includes('analiza') || lowerContent.includes('lee') || lowerContent.includes('revisa')) {
            status = 'Analyzing...';
        } else if (lowerContent.includes('busca') || lowerContent.includes('investiga')) {
            status = 'Researching...';
        } else if (lowerContent.includes('modifica') || lowerContent.includes('cambia') || lowerContent.includes('actualiza') || lowerContent.includes('corrige')) {
            status = 'Modifying...';
        }
        setStatusMessage(status);

        try {
            // Get latest messages for history from the ref
            const currentConv = conversationsRef.current.find(c => c.id === activeConversationId);
            let history = currentConv?.messages || [];

            // Ensure the user message we just added is included in the history sent to the API
            if (!history.find(m => m.id === userMessage.id)) {
                history = [...history, userMessage];
            }

            const response = await fetch('/api/ai/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: processedContent,
                    history: history.map(m => ({ role: m.role, content: m.content })),
                    attachments: messageAttachments,
                    webSearchEnabled,
                    model: selectedModel,
                    twinMode
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API error: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let accumulatedContent = '';
            const streamingMsgId = crypto.randomUUID();

            setStreamingMessage({
                id: streamingMsgId,
                role: 'assistant',
                content: '',
                timestamp: new Date().toISOString(),
                model: 'auto'
            });

            let activeModelLabel = 'Cognitive Core';
            let activeIntent: string | undefined;
            let activeFallback = false;

            // SSE frames don't align with network chunk boundaries — see
            // lib/ai/sse-buffer.ts for why this needs a carry-over buffer.
            let sseBuffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const { lines, buffer } = splitSseLines(decoder.decode(value, { stream: true }), sseBuffer);
                sseBuffer = buffer;

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const json = JSON.parse(data);

                            // Parse model metadata from orchestra
                            if (json.meta) {
                                activeModelLabel = json.meta.label || activeModelLabel;
                                activeIntent = json.meta.intent;
                                activeFallback = !!json.meta.fallback;
                                setStreamingMessage(prev => prev ? {
                                    ...prev,
                                    model: activeModelLabel,
                                    intent: activeIntent,
                                    fallback: activeFallback
                                } : prev);
                                continue;
                            }

                            if (json.content) {
                                accumulatedContent += json.content;
                                setStreamingMessage({
                                    id: streamingMsgId,
                                    role: 'assistant',
                                    content: accumulatedContent,
                                    timestamp: new Date().toISOString(),
                                    model: activeModelLabel,
                                    intent: activeIntent,
                                    fallback: activeFallback
                                });
                            }
                        } catch (e) { }
                    }
                }
            }
            // Flush any final buffered frame left without a trailing newline.
            const finalFrame = parseFinalSseLine(sseBuffer);
            if (finalFrame?.content) {
                accumulatedContent += finalFrame.content;
            }

            setStreamingMessage(null);

            let finalContent = accumulatedContent;
            let blocks: MessageBlock[] = [];

            try {
                // 1. Try to find JSON in various formats
                const jsonBlockMatch = accumulatedContent.match(/```json\s*([\s\S]*?)\s*```/);
                const genericBlockMatch = accumulatedContent.match(/```\s*(\{[\s\S]*?\})\s*```/);
                const rawJsonMatch = accumulatedContent.match(/(\{[\s\S]*\})/);

                let jsonStr = '';
                let fullMatch = '';

                if (jsonBlockMatch) {
                    jsonStr = jsonBlockMatch[1];
                    fullMatch = jsonBlockMatch[0];
                } else if (genericBlockMatch) {
                    jsonStr = genericBlockMatch[1];
                    fullMatch = genericBlockMatch[0];
                } else if (rawJsonMatch) {
                    const match = rawJsonMatch[1];
                    if (match.includes('"action"') || match.includes('"plan"') || match.includes('"analysis"')) {
                        jsonStr = match;
                        fullMatch = match;
                    }
                }

                if (jsonStr) {
                    try {
                        // Robust JSON cleaning
                        let cleanedJson = jsonStr.trim();

                        // Remove trailing commas in objects and arrays
                        cleanedJson = cleanedJson.replace(/,\s*([}\]])/g, '$1');

                        const parsed = JSON.parse(cleanedJson);
                        console.log('[Chatbot] Parsed JSON:', parsed);

                        // 1. Robust Action Extraction
                        let rawAction = parsed.action || parsed.accion;
                        let extractedType = '';
                        let extractedPayload = {};

                        if (rawAction) {
                            if (typeof rawAction === 'string') {
                                // Case: { "action": "CREATE_TASKS", "payload": { ... } }
                                extractedType = rawAction;
                                extractedPayload = parsed.payload || parsed.parametros || parsed.data || {};
                            } else if (typeof rawAction === 'object') {
                                // Case: { "action": { "type": "CREATE_TASKS", "payload": { ... } } }
                                extractedType = rawAction.type || rawAction.tipo || rawAction.name || '';
                                extractedPayload = rawAction.payload || rawAction.parametros || rawAction.data || {};
                            }
                        } else {
                            // Case: { "type": "CREATE_TASKS", "payload": { ... } } (top-level)
                            extractedType = parsed.type || parsed.tipo || parsed.name || '';
                            extractedPayload = parsed.payload || parsed.parametros || parsed.data || {};
                        }

                        // 2. Robust Metadata Extraction
                        const mapped: any = {
                            analysis: parsed.analysis || parsed.analisis,
                            plan: parsed.plan,
                            message: parsed.message || parsed.mensaje,
                            action: extractedType ? {
                                type: extractedType,
                                payload: extractedPayload
                            } : null
                        };

                        console.log('[Chatbot] Mapped Structure:', mapped);

                        const isStructured = mapped.message || mapped.analysis || mapped.plan || mapped.action;

                        if (isStructured) {
                            // 2. Extract the explanation (everything before or after the JSON)
                            const explanation = accumulatedContent.replace(fullMatch, '').trim();

                            // 3. Build blocks
                            if (explanation) {
                                blocks.push({ id: crypto.randomUUID(), type: 'markdown', content: explanation });
                            }

                            if (mapped.analysis) {
                                blocks.push({ id: crypto.randomUUID(), type: 'analysis', content: mapped.analysis });
                            }

                            if (mapped.plan) {
                                blocks.push({ id: crypto.randomUUID(), type: 'plan', content: mapped.plan });
                            }

                            if (mapped.action) {
                                // Validate action type
                                const validTypes = [
                                    'CREATE_TASK', 'CREATE_TASKS', 'UPDATE_TASK', 'DELETE_TASK',
                                    'CREATE_PROJECT', 'UPDATE_PROJECT', 'DELETE_PROJECT',
                                    'CREATE_ROUTINE', 'UPDATE_ROUTINE', 'DELETE_ROUTINE',
                                    'START_WORKOUT', 'FINISH_WORKOUT',
                                    'CREATE_COURSE', 'UPDATE_COURSE', 'DELETE_COURSE',
                                    'ADD_GRADE', 'UPDATE_GRADE', 'DELETE_GRADE',
                                    'CREATE_NOTE', 'UPDATE_NOTE',
                                    'CREATE_EVENT', 'CREATE_TRACKER', 'SEND_EMAIL', 'REQUEST_INFO',
                                    'ANALYZE_PROGRESS', 'SYSTEM_QUERY', 'DELETE_ALL_TASKS',
                                    'GENERATE_FILE', 'UPDATE_COGNITIVE_STATE', 'COGNITIVE_PIPELINE'
                                ];

                                let finalType = mapped.action.type;

                                // Translation Map (Spanish to English Action Types)
                                const typeMap: Record<string, string> = {
                                    'crear_tarea': 'CREATE_TASK',
                                    'crear_tareas': 'CREATE_TASKS',
                                    'actualizar_tarea': 'UPDATE_TASK',
                                    'eliminar_tarea': 'DELETE_TASK',
                                    'crear_proyecto': 'CREATE_PROJECT',
                                    'actualizar_proyecto': 'UPDATE_PROJECT',
                                    'eliminar_proyecto': 'DELETE_PROJECT',
                                    'crear_rutina': 'CREATE_ROUTINE',
                                    'actualizar_rutina': 'UPDATE_ROUTINE',
                                    'eliminar_rutina': 'DELETE_ROUTINE',
                                    'empezar_entrenamiento': 'START_WORKOUT',
                                    'terminar_entrenamiento': 'FINISH_WORKOUT',
                                    'crear_curso': 'CREATE_COURSE',
                                    'actualizar_curso': 'UPDATE_COURSE',
                                    'eliminar_curso': 'DELETE_COURSE',
                                    'agregar_nota': 'ADD_GRADE',
                                    'actualizar_nota': 'UPDATE_GRADE',
                                    'eliminar_nota': 'DELETE_GRADE',
                                    'crear_nota': 'CREATE_NOTE',
                                    'actualizar_nota_rapida': 'UPDATE_NOTE',
                                    'analizar_progreso': 'ANALYZE_PROGRESS',
                                    'consulta_sistema': 'SYSTEM_QUERY',
                                    'eliminar_todas_las_tareas': 'DELETE_ALL_TASKS',
                                    'crear_evento': 'CREATE_EVENT',
                                    'agendar_evento': 'CREATE_EVENT',
                                    'crear_tracker': 'CREATE_TRACKER',
                                    'crear_habito': 'CREATE_TRACKER',
                                    'enviar_correo': 'SEND_EMAIL',
                                    'enviar_email': 'SEND_EMAIL',
                                    'mandar_correo': 'SEND_EMAIL',
                                    'solicitar_info': 'REQUEST_INFO',
                                    'pedir_detalles': 'REQUEST_INFO'
                                };

                                if (typeMap[finalType.toLowerCase()]) {
                                    finalType = typeMap[finalType.toLowerCase()];
                                }

                                // Fallback: If action is unknown but has tasks, map to CREATE_TASKS
                                if (!validTypes.includes(finalType)) {
                                    if (mapped.action.payload?.tasks || Array.isArray(mapped.action.payload)) {
                                        finalType = 'CREATE_TASKS';
                                        if (Array.isArray(mapped.action.payload) && !mapped.action.payload.tasks) {
                                            mapped.action.payload = { tasks: mapped.action.payload };
                                        }
                                    } else if (finalType.includes(' ') || finalType.length > 25) {
                                        // Heuristic: If it's a sentence, it's likely a hallucinated description
                                        console.warn(`[Chatbot] Hallucinated action type detected: ${finalType}`);
                                        // If it looks like a task (has title or description in payload)
                                        if (mapped.action.payload?.title || mapped.action.payload?.name || mapped.action.payload?.text) {
                                            finalType = 'CREATE_TASK';
                                        } else if (mapped.action.payload?.tasks) {
                                            finalType = 'CREATE_TASKS';
                                        } else {
                                            // Default to SYSTEM_QUERY if we can't tell, or just leave as is
                                            // Actually, let's keep it as is but log it clearly
                                            console.warn(`[Chatbot] Could not auto-map hallucination: ${finalType}`);
                                        }
                                    } else {
                                        console.warn(`[Chatbot] Unknown action type: ${finalType}`);
                                    }
                                }

                                const action = {
                                    ...mapped.action,
                                    type: finalType,
                                    name: finalType
                                };

                                // Handle auto-executed actions (short-circuits)
                                if (mapped.action?._executed && mapped.action?._result) {
                                    const res = mapped.action._result;
                                    blocks.push({
                                        id: crypto.randomUUID(),
                                        type: 'result',
                                        content: res.message || 'Operación completada.',
                                        status: res.success ? 'success' : 'failed',
                                        metadata: res.metadata || {}
                                    });
                                } else if (finalType === 'REQUEST_INFO') {
                                    // The model flagged the request as ambiguous — render a mini
                                    // form instead of a confirmation card so the user can fill in
                                    // exactly what's missing before anything is created.
                                    blocks.push({
                                        id: crypto.randomUUID(),
                                        type: 'clarification_form',
                                        content: action.payload,
                                        status: 'waiting'
                                    });
                                } else if (AUTO_EXECUTE_ACTION_TYPES.has(finalType)) {
                                    // Additive/reversible action — run it now instead of pushing a
                                    // 'confirmation' block. The assistant's own reply already reads
                                    // as "He creado tu tarea" (done), so gating it behind a manual
                                    // Confirm click contradicted the text; this keeps the two in
                                    // sync while reserving the manual confirm step (below) for
                                    // actions that mutate or remove something that already exists.
                                    try {
                                        const execResponse = await fetch('/api/ai/execute', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                action: { ...action, payload: { ...action.payload, confirmed: true } }
                                            })
                                        });
                                        const execResult = await execResponse.json();
                                        blocks.push({
                                            id: crypto.randomUUID(),
                                            type: 'result',
                                            content: execResult.output || (execResult.success ? 'Listo.' : 'No se pudo completar la acción.'),
                                            status: (execResult.success ? 'success' : 'failed') as any,
                                            metadata: execResult.metadata
                                        });
                                    } catch (execErr) {
                                        console.error('[Chatbot] Auto-execute error:', execErr);
                                        blocks.push({
                                            id: crypto.randomUUID(),
                                            type: 'result',
                                            content: 'No se pudo completar la acción. Intenta de nuevo.',
                                            status: 'failed' as any
                                        });
                                    }
                                } else {
                                    blocks.push({ id: crypto.randomUUID(), type: 'confirmation', content: action, status: 'waiting' });
                                }
                            }

                            // Extract Cognitive, Music and Outfit blocks if present
                            if (parsed.cognitive_update || parsed.cognitiveUpdate) {
                                blocks.push({
                                    id: crypto.randomUUID(),
                                    type: 'cognitive_update',
                                    content: parsed.cognitive_update || parsed.cognitiveUpdate
                                });
                            } else if (mapped.action?.type === 'UPDATE_COGNITIVE_STATE') {
                                const p = mapped.action.payload || {};
                                blocks.push({
                                    id: crypto.randomUUID(),
                                    type: 'cognitive_update',
                                    content: {
                                        focusScore: p.focusTimeToday !== undefined ? Math.min(100, Math.round(p.focusTimeToday * 10)) : 75,
                                        fatigueEstimate: p.fatigueEstimate || 'medium',
                                        burnoutRisk: p.productivityScore !== undefined ? Math.round(100 - p.productivityScore) : 35,
                                        energyLevel: p.fatigueEstimate === 'low' ? 'alta' : p.fatigueEstimate === 'medium' ? 'media' : 'baja',
                                        recommendation: p.styleRecommendation?.suggestion || p.musicRecommendation?.mood || 'Considera tomar un breve descanso.'
                                    }
                                });
                            }

                            if (parsed.music_recommendation || parsed.musicRecommendation) {
                                blocks.push({
                                    id: crypto.randomUUID(),
                                    type: 'music_recommendation',
                                    content: parsed.music_recommendation || parsed.musicRecommendation
                                });
                            } else if (mapped.action?.type === 'UPDATE_COGNITIVE_STATE' && mapped.action.payload?.musicRecommendation) {
                                const mr = mapped.action.payload.musicRecommendation;
                                blocks.push({
                                    id: crypto.randomUUID(),
                                    type: 'music_recommendation',
                                    content: {
                                        mood: mr.mood || 'Focus',
                                        searchQuery: mr.searchQuery || 'ambient music',
                                        reason: 'Optimizado para reducir la fatiga cognitiva estimulando el foco.',
                                        frequency: 'Binaural Beats (40Hz)'
                                    }
                                });
                            }

                            if (parsed.outfit_recommendation || parsed.outfitRecommendation) {
                                blocks.push({
                                    id: crypto.randomUUID(),
                                    type: 'outfit_recommendation',
                                    content: parsed.outfit_recommendation || parsed.outfitRecommendation
                                });
                            } else if (mapped.action?.type === 'UPDATE_COGNITIVE_STATE' && mapped.action.payload?.styleRecommendation) {
                                const sr = mapped.action.payload.styleRecommendation;
                                blocks.push({
                                    id: crypto.randomUUID(),
                                    type: 'outfit_recommendation',
                                    content: {
                                        outfit: sr.suggestion || 'Prendas cómodas de tonos neutros.',
                                        style: 'Minimalista & Confort',
                                        context: sr.context || 'Trabajo enfocado y recuperación',
                                        psychology: sr.colorPsychology || 'Los colores neutros reducen la carga cognitiva.',
                                        colorPalette: ['#f5f5f5', '#d4d4d8', '#71717a', '#27272a'],
                                        items: [
                                            { name: 'Sudadera Cómoda', category: 'Superior' },
                                            { name: 'Pantalón Neutro', category: 'Inferior' }
                                        ]
                                    }
                                });
                            }

                            if (mapped.message && mapped.message !== explanation) {
                                blocks.push({ id: crypto.randomUUID(), type: 'markdown', content: mapped.message });
                            }

                            finalContent = explanation || mapped.message || 'Respuesta estructurada';
                        }
                    } catch (parseError) {
                        console.error('[Chatbot] JSON parse error:', parseError);
                    }
                }
            } catch (e) {
                console.error('[Chatbot] Block creation error:', e);
            }

            const assistantMessage: Message = {
                id: streamingMsgId,
                role: 'assistant',
                content: finalContent,
                blocks: blocks.length > 0 ? blocks : undefined,
                timestamp: new Date().toISOString(),
                model: activeModelLabel
            };

            setConversations(prev => prev.map(c =>
                c.id === activeConversationId
                    ? {
                        ...c,
                        messages: [...c.messages, assistantMessage],
                        updatedAt: new Date().toISOString()
                    }
                    : c
            ));

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Error desconocido';
            setError(errMsg);
            console.error('Send message error:', err);
            setStreamingMessage(null);
            // Nothing in chat-area.tsx/chat-input.tsx renders context.error —
            // without this, a request that fails before/outside the stream
            // loop (network error, non-ok response) left the user's message
            // sitting with no reply and no visible failure at all.
            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `⚠️ No se pudo obtener una respuesta: ${errMsg}. Intenta de nuevo.`,
                timestamp: new Date().toISOString(),
            };
            setConversations(prev => prev.map(c =>
                c.id === activeConversationId
                    ? { ...c, messages: [...c.messages, errorMessage], updatedAt: new Date().toISOString() }
                    : c
            ));
        } finally {
            setIsLoading(false);
            setIsTyping(false);
            setStatusMessage(null);
        }
    }, [currentConversationId, selectedModel, twinMode]);

    const confirmAction = useCallback(async (messageId: string, blockId: string) => {
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (!conversation) return;

        const message = conversation.messages.find(m => m.id === messageId);
        if (!message || !message.blocks) return;

        const block = message.blocks.find(b => b.id === blockId);
        if (!block || block.type !== 'confirmation') return;

        const updatedBlocks = message.blocks.map(b =>
            b.id === blockId ? { ...b, status: 'confirmed' as const } : b
        );

        const executingBlock: MessageBlock = {
            id: crypto.randomUUID(),
            type: 'result',
            content: 'Executing action...',
            status: 'pending' as const
        };

        const tempBlocks = [...updatedBlocks, executingBlock];
        const updatedMessages = conversation.messages.map(m =>
            m.id === messageId ? { ...m, blocks: tempBlocks } : m
        );
        updateConversation(currentConversationId!, { messages: updatedMessages });

        try {
            const confirmedAction = {
                ...(block.content || {}),
                payload: {
                    ...((block.content as any)?.payload || {}),
                    confirmed: true
                }
            };
            console.log('[Chatbot] Executing action with confirmation:', confirmedAction);
            const response = await fetch('/api/ai/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: confirmedAction })
            });

            const result = await response.json();
            const resultBlock: MessageBlock = {
                id: executingBlock.id,
                type: 'result',
                content: result.output,
                status: (result.success ? 'success' : 'failed') as any,
                metadata: result.metadata
            };

            const finalBlocks = updatedBlocks.map(b => {
                if (b.type === 'plan' && Array.isArray(b.content)) {
                    return {
                        ...b,
                        content: b.content.map((item: any) => ({
                            ...item,
                            status: result.success ? 'success' : 'failed'
                        }))
                    };
                }
                return b;
            });

            finalBlocks.push(resultBlock);
            const finalMessages = conversation.messages.map(m =>
                m.id === messageId ? { ...m, blocks: finalBlocks } : m
            );
            updateConversation(currentConversationId!, { messages: finalMessages });

            // --- Auto-follow-up: Send data back to AI for formatting ---
            const actionContent = block.content as any;
            const actionType = actionContent?.type || actionContent?.name || '';
            const hasResultData = result.success && result.metadata;

            // For SYSTEM_QUERY or actions with complex data, auto-generate a formatted follow-up
            if (hasResultData && (actionType === 'SYSTEM_QUERY' || (result.metadata && typeof result.metadata === 'object'))) {
                try {
                    // Build a compact summary of the result data for the AI
                    let dataSummary = '';
                    if (result.metadata && typeof result.metadata === 'object') {
                        // For SYSTEM_QUERY, the data is in the result output or metadata
                        const rawData = result.output || JSON.stringify(result.metadata);
                        // Truncate if too large to avoid token overflow
                        dataSummary = typeof rawData === 'string' ? rawData.slice(0, 4000) : JSON.stringify(rawData).slice(0, 4000);
                    }

                    if (dataSummary && actionType === 'SYSTEM_QUERY') {
                        setIsLoading(true);
                        setIsTyping(true);
                        setStatusMessage('Formatting results...');

                        // Find the original user message that triggered this action
                        const userMessages = conversation.messages.filter(m => m.role === 'user');
                        const lastUserMessage = userMessages[userMessages.length - 1];
                        const originalRequest = lastUserMessage?.content || 'Show me the results';

                        const followUpResponse = await fetch('/api/ai/stream', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                message: `The user originally asked: "${originalRequest}". The system returned the following data from a SYSTEM_QUERY. Please present this data in a clean, formatted, and readable way using markdown. Highlight the most important/critical items. Do NOT create any action or JSON - just format the data nicely:\n\n${dataSummary}`,
                                history: conversation.messages.slice(-4).map(m => ({ role: m.role, content: m.content })),
                            })
                        });

                        if (followUpResponse.ok && followUpResponse.body) {
                            const reader = followUpResponse.body.getReader();
                            const decoder = new TextDecoder();
                            let followUpContent = '';
                            const followUpMsgId = crypto.randomUUID();

                            setStreamingMessage({
                                id: followUpMsgId,
                                role: 'assistant',
                                content: '',
                                timestamp: new Date().toISOString(),
                                model: 'auto'
                            });

                            // Same SSE chunk-boundary buffering as the main
                            // stream loop above (see lib/ai/sse-buffer.ts).
                            let followUpBuffer = '';
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                const { lines, buffer } = splitSseLines(decoder.decode(value, { stream: true }), followUpBuffer);
                                followUpBuffer = buffer;
                                for (const line of lines) {
                                    if (line.startsWith('data: ')) {
                                        const data = line.slice(6);
                                        if (data === '[DONE]') continue;
                                        try {
                                            const json = JSON.parse(data);
                                            if (json.content) {
                                                followUpContent += json.content;
                                                setStreamingMessage({
                                                    id: followUpMsgId,
                                                    role: 'assistant',
                                                    content: followUpContent,
                                                    timestamp: new Date().toISOString(),
                                                    model: 'auto'
                                                });
                                            }
                                        } catch (e) { }
                                    }
                                }
                            }
                            const followUpFinalFrame = parseFinalSseLine(followUpBuffer);
                            if (followUpFinalFrame?.content) followUpContent += followUpFinalFrame.content;

                            setStreamingMessage(null);

                            if (followUpContent.trim()) {
                                const followUpMessage: Message = {
                                    id: followUpMsgId,
                                    role: 'assistant',
                                    content: followUpContent,
                                    timestamp: new Date().toISOString(),
                                    model: 'qwen/qwen3-32b'
                                };

                                setConversations(prev => prev.map(c =>
                                    c.id === currentConversationId
                                        ? { ...c, messages: [...c.messages, followUpMessage], updatedAt: new Date().toISOString() }
                                        : c
                                ));
                            }
                        }

                        setIsLoading(false);
                        setIsTyping(false);
                        setStatusMessage(null);
                    }
                } catch (followUpError) {
                    console.error('[Chatbot] Auto-follow-up error:', followUpError);
                    setIsLoading(false);
                    setIsTyping(false);
                    setStatusMessage(null);
                }
            }

        } catch (error) {
            console.error('Execution error:', error);
            const errorBlock: MessageBlock = {
                id: executingBlock.id,
                type: 'result',
                content: 'Failed to execute action. Please try again.',
                status: 'failed' as const
            };
            const finalBlocks = [...updatedBlocks, errorBlock];
            const finalMessages = conversation.messages.map(m =>
                m.id === messageId ? { ...m, blocks: finalBlocks } : m
            );
            updateConversation(currentConversationId!, { messages: finalMessages });
        }
    }, [conversations, currentConversationId, updateConversation]);

    const cancelAction = useCallback((messageId: string, blockId: string) => {
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (!conversation) return;

        const message = conversation.messages.find(m => m.id === messageId);
        if (!message || !message.blocks) return;

        const updatedBlocks = message.blocks.map(b =>
            b.id === blockId ? { ...b, status: 'cancelled' as const } : b
        );

        const updatedMessages = conversation.messages.map(m =>
            m.id === messageId ? { ...m, blocks: updatedBlocks } : m
        );
        updateConversation(currentConversationId!, { messages: updatedMessages });
    }, [conversations, currentConversationId, updateConversation]);

    // Called when the user fills in the mini clarification form (rendered when
    // the AI flags a creation request as ambiguous via REQUEST_INFO). Merges
    // the form values into the originally-intended action and hands off to
    // the normal confirmation flow — the user still explicitly confirms the
    // completed action before anything is created.
    const submitClarification = useCallback((messageId: string, blockId: string, values: Record<string, any>) => {
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (!conversation) return;

        const message = conversation.messages.find(m => m.id === messageId);
        if (!message || !message.blocks) return;

        const block = message.blocks.find(b => b.id === blockId);
        if (!block || block.type !== 'clarification_form') return;

        const request = block.content as { pendingAction: string; knownPayload?: Record<string, any> };
        const completedAction = {
            type: request.pendingAction,
            name: request.pendingAction,
            payload: { ...(request.knownPayload || {}), ...values },
        };

        const updatedBlocks = message.blocks.map(b =>
            b.id === blockId ? { ...b, status: 'confirmed' as const } : b
        );
        updatedBlocks.push({
            id: crypto.randomUUID(),
            type: 'confirmation',
            content: completedAction,
            status: 'waiting',
        });

        const updatedMessages = conversation.messages.map(m =>
            m.id === messageId ? { ...m, blocks: updatedBlocks } : m
        );
        updateConversation(currentConversationId!, { messages: updatedMessages });
    }, [conversations, currentConversationId, updateConversation]);

    const editMessage = useCallback(async (messageId: string, newContent: string) => {
        if (!currentConversationId) return;

        const conversation = conversations.find(c => c.id === currentConversationId);
        if (!conversation) return;

        const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;

        // Truncate to before the edited message (drops the old assistant reply
        // too), then resend through sendMessage — the same delegation
        // retryMessage already uses below. This used to be a ~140-line inline
        // duplicate of the stream-reading loop that only ever accumulated raw
        // text: no JSON action-block parsing, so an edited message that
        // triggered an action showed the model's literal ```json fence
        // instead of a confirmation/result card. Routing through sendMessage
        // gives edits the same generative-UI handling as a normal send.
        const previousMessages = conversation.messages.slice(0, messageIndex);
        updateConversation(currentConversationId, { messages: previousMessages });
        await sendMessage(newContent);
    }, [conversations, currentConversationId, sendMessage, updateConversation]);

    const retryMessage = useCallback(async (messageId: string) => {
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1 || messageIndex === 0) return;

        const userMessage = messages[messageIndex - 1];
        if (userMessage.role !== 'user') return;

        const newMessages = messages.slice(0, messageIndex);
        updateConversation(currentConversationId!, { messages: newMessages });
        await sendMessage(userMessage.content);
    }, [messages, currentConversationId, sendMessage, updateConversation]);

    const likeMessage = useCallback((messageId: string) => {
        const updated = messages.map(m =>
            m.id === messageId ? { ...m, liked: !m.liked, disliked: false } : m
        );
        updateConversation(currentConversationId!, { messages: updated });
    }, [messages, currentConversationId, updateConversation]);

    const dislikeMessage = useCallback((messageId: string) => {
        const updated = messages.map(m =>
            m.id === messageId ? { ...m, disliked: !m.disliked, liked: false } : m
        );
        updateConversation(currentConversationId!, { messages: updated });
    }, [messages, currentConversationId, updateConversation]);
    const value: ChatbotContextType = {
        conversations,
        currentConversationId,
        setCurrentConversationId,
        createConversation,
        deleteConversation,
        updateConversation,
        messages,
        sendMessage,
        retryMessage,
        editMessage,
        likeMessage,
        dislikeMessage,
        confirmAction,
        cancelAction,
        submitClarification,
        sidebarCollapsed,
        setSidebarCollapsed,
        artifactsPanelCollapsed,
        setArtifactsPanelCollapsed,
        selectedModel,
        setSelectedModel,
        availableModels,
        twinMode,
        setTwinMode,
        twinModeAvailable,
        isLoading,
        isTyping,
        streamingMessage,
        statusMessage,
        error
    };

    return (
        <ChatbotContext.Provider value={value}>
            {children}
        </ChatbotContext.Provider>
    );
}
