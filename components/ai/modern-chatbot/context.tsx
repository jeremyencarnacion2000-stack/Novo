'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { ChatbotContextType, Conversation, Message, AIModel, FileAttachment, MessageBlock, Attachment } from './types';
import { splitSseLines, parseFinalSseLine } from '@/lib/ai/sse-buffer';
import { sileo } from '@/lib/sileo-bell';
import { createClientIdempotencyKey } from '@/lib/client-idempotency';

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
    'CREATE_NOTE', 'CREATE_TRACKER', 'CREATE_COURSE',
    'ADD_GRADE', 'START_WORKOUT', 'FINISH_WORKOUT', 'GENERATE_FILE',
    'ANALYZE_PROGRESS', 'SYSTEM_QUERY'
]);

export function ChatbotProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status: authStatus } = useSession();
    const chatbotStorageKey = session?.user?.id ? `user:${session.user.id}` : null;
    const accountGenerationRef = React.useRef(0);
    const accountAbortRef = React.useRef<AbortController | null>(null);
    const [hydratedChatbotKey, setHydratedChatbotKey] = useState<string | null>(null);
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
    // A single chat submission may involve several async stages (attachment
    // parsing, provider fetch, SSE consumption). UI state alone is not a safe
    // lock because two events can enter before React re-renders; this ref
    // prevents duplicate user messages and duplicate AI activity runs.
    const sendInFlightRef = React.useRef(false);
    // Keep action confirmation outside React state so two pointer events in
    // the same render cannot execute a mutation twice. Keys survive a failed
    // request, allowing an explicit retry to replay the server mutation.
    const executingActionRef = React.useRef(new Set<string>());
    const actionIntentKeysRef = React.useRef(new Map<string, string>());
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const availableModels: AIModel[] = [
        {
            id: 'openai/gpt-oss-120b',
            name: 'Cognitive Core',
            provider: 'GPT-OSS 120B',
            description: 'Razonamiento avanzado, código y conversación general. Recomendado.',
            enabled: true
        },
        {
            id: 'openai/gpt-oss-20b',
            name: 'Fast Engine',
            provider: 'GPT-OSS 20B',
            description: 'Velocidad ultra rápida e ideal para tareas cotidianas.',
            enabled: true
        },
        {
            id: 'gemini-flash-latest',
            name: 'Vision Scout',
            provider: 'Gemini Flash',
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

    // ChatbotProvider survives auth transitions. Reset the in-memory account
    // boundary before loading another user's conversations and cancel work
    // that could otherwise resolve after the session changed.
    useEffect(() => {
        accountGenerationRef.current += 1;
        accountAbortRef.current?.abort();
        accountAbortRef.current = null;
        setHydratedChatbotKey(null);
        setConversations([]);
        setCurrentConversationId(null);
        setStreamingMessage(null);
        setIsLoading(false);
        setIsTyping(false);
        setStatusMessage(null);
        setError(null);
        sendInFlightRef.current = false;
        executingActionRef.current.clear();
        actionIntentKeysRef.current.clear();
        persistedRef.current.clear();
        justLoadedFromDbRef.current = false;
        savingRef.current.clear();
        dirtySaveRef.current.clear();
    }, [authStatus, chatbotStorageKey]);

    // Load from database on mount. ChatbotProvider mounts app-wide (including
    // public /landing, /auth/* pages), so both fetches below wait for a real
    // session — otherwise every logged-out page load throws two 401s.
    useEffect(() => {
        if (authStatus !== 'authenticated' || !chatbotStorageKey) return;
        const generation = accountGenerationRef.current;
        const controller = new AbortController();
        accountAbortRef.current = controller;
        const scopedKey = (key: string) => `${key}:${chatbotStorageKey}`;

        async function loadConversations() {
            try {
                const response = await fetch('/api/ai-conversations', { signal: controller.signal });
                if (response.ok && !controller.signal.aborted && accountGenerationRef.current === generation) {
                    const dbConversations = await response.json();
                    if (!controller.signal.aborted && accountGenerationRef.current === generation && dbConversations.length > 0) {
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
                if (!controller.signal.aborted) console.error('Failed to load conversations from database:', error);
            }
        }
        loadConversations();

        const sidebarState = localStorage.getItem(scopedKey(SIDEBAR_KEY));
        if (sidebarState) {
            setSidebarCollapsed(sidebarState === 'true');
        }

        const storedModel = localStorage.getItem(scopedKey(MODEL_KEY));
        if (storedModel) {
            let mappedModel = storedModel;
            if (mappedModel === 'qwen-2.5-coder-32b' || mappedModel === 'qwen3-32b' || mappedModel === 'qwen/qwen3-32b' || mappedModel === 'llama-3.3-70b-versatile') {
                mappedModel = 'openai/gpt-oss-120b';
            } else if (mappedModel === 'meta-llama/llama-4-scout-17b-16e-instruct' || mappedModel === 'llama-3.2-11b-vision-preview') {
                mappedModel = 'gemini-flash-latest';
            } else if (mappedModel === 'llama-3.1-8b-instant') {
                mappedModel = 'openai/gpt-oss-20b';
            }

            // Ensure it is one of the available models
            const isValid = ['auto', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'gemini-flash-latest'].includes(mappedModel);
            const finalModel = isValid ? mappedModel : 'auto';
            
            setSelectedModel(finalModel);
        }

        // Read before the "Save Twin Mode preference" effect below can run —
        // that effect fires synchronously on mount (twinMode starts false)
        // and writes "false" to this same key, so reading it lazily inside
        // this .then() always saw "false" instead of the true first-run
        // null, meaning Pro's "default on" branch could never fire.
        const storedTwinModeAtMount = localStorage.getItem(scopedKey(TWIN_MODE_KEY));
        fetch('/api/billing/status', { signal: controller.signal })
            .then(r => r.ok ? r.json() : null)
            .then(status => {
                if (controller.signal.aborted || accountGenerationRef.current !== generation) return;
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
            .catch(error => {
                if (!controller.signal.aborted) console.error('Failed to load chat billing status:', error);
            })
            .finally(() => {
                if (!controller.signal.aborted && accountGenerationRef.current === generation) {
                    setHydratedChatbotKey(chatbotStorageKey);
                }
            });

        return () => controller.abort();
    }, [authStatus, chatbotStorageKey]);

    // Track which conversations are currently being saved to avoid duplicates
    const savingRef = React.useRef<Set<string>>(new Set());
    // A state update can arrive while its previous write is still in flight.
    // Remember that a newer snapshot exists so it is persisted immediately
    // after the current request, instead of being silently skipped.
    const dirtySaveRef = React.useRef<Set<string>>(new Set());

    const saveConversation = useCallback(async (conv: Conversation): Promise<void> => {
        if (!chatbotStorageKey || hydratedChatbotKey !== chatbotStorageKey) return;
        const generation = accountGenerationRef.current;
        const signal = accountAbortRef.current?.signal;
        const cleanId = conv.id.replace(/\/$/, '');
        if (savingRef.current.has(cleanId)) {
            dirtySaveRef.current.add(cleanId);
            return;
        }

        savingRef.current.add(cleanId);
        try {
            if (signal?.aborted || generation !== accountGenerationRef.current) return;
            const isPersisted = persistedRef.current.has(cleanId);
            if (isPersisted) {
                await fetch(`/api/ai-conversations/${cleanId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: conv.title, messages: conv.messages, model: conv.model }),
                    signal,
                });
            } else {
                const response = await fetch('/api/ai-conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: cleanId, title: conv.title, messages: conv.messages, model: conv.model }),
                    signal,
                });
                if (response.ok && generation === accountGenerationRef.current) {
                    persistedRef.current.add(cleanId);

                    // A replay means the original create reached the server
                    // but its response was lost. The row may contain the
                    // snapshot from that first attempt, which can be older
                    // than the one currently in memory (for example when the
                    // user kept typing while the request was in flight).
                    // Converge with the latest local snapshot immediately so
                    // a retry can never silently discard the new messages.
                    if (response.headers.get('X-Idempotent-Replay') === 'true') {
                        const replayUpdate = await fetch(`/api/ai-conversations/${cleanId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: conv.title, messages: conv.messages, model: conv.model }),
                            signal,
                        });
                        if (!replayUpdate.ok) {
                            throw new Error(`Conversation replay reconciliation failed (${replayUpdate.status})`);
                        }
                    }
                }
            }
        } catch (error) {
            if (!signal?.aborted) console.error('Failed to save conversation to database:', error);
        } finally {
            savingRef.current.delete(cleanId);
            if (generation === accountGenerationRef.current && dirtySaveRef.current.delete(cleanId)) {
                const latest = conversationsRef.current.find((item) => item.id === conv.id);
                if (latest) void saveConversation(latest);
            }
        }
    }, [chatbotStorageKey, hydratedChatbotKey]);

    // Save conversations to database when they change
    useEffect(() => {
        if (!chatbotStorageKey || hydratedChatbotKey !== chatbotStorageKey) return;
        if (justLoadedFromDbRef.current) {
            // This run was triggered by loading conversations from the DB,
            // not a real edit — they're already persisted as-is.
            justLoadedFromDbRef.current = false;
            return;
        }
        if (conversations.length === 0) return;

        const conversationsToSave = conversations.filter(conv => (
            conv.messages.length > 0 || conv.title !== 'Nueva conversación'
        ));
        const timeoutId = setTimeout(() => {
            for (const conv of conversationsToSave) void saveConversation(conv);
        }, 2000); // Increased delay to reduce noise
        return () => clearTimeout(timeoutId);
    }, [conversations, saveConversation, chatbotStorageKey, hydratedChatbotKey]);

    // Save sidebar state
    useEffect(() => {
        if (!chatbotStorageKey || hydratedChatbotKey !== chatbotStorageKey) return;
        localStorage.setItem(`${SIDEBAR_KEY}:${chatbotStorageKey}`, sidebarCollapsed.toString());
    }, [sidebarCollapsed, chatbotStorageKey, hydratedChatbotKey]);

    // Save model selection
    useEffect(() => {
        if (!chatbotStorageKey || hydratedChatbotKey !== chatbotStorageKey) return;
        localStorage.setItem(`${MODEL_KEY}:${chatbotStorageKey}`, selectedModel);
    }, [selectedModel, chatbotStorageKey, hydratedChatbotKey]);

    // Save Twin Mode preference
    useEffect(() => {
        if (!chatbotStorageKey || hydratedChatbotKey !== chatbotStorageKey) return;
        localStorage.setItem(`${TWIN_MODE_KEY}:${chatbotStorageKey}`, twinMode.toString());
    }, [twinMode, chatbotStorageKey, hydratedChatbotKey]);

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
        if (sendInFlightRef.current) return;
        sendInFlightRef.current = true;
        const requestGeneration = accountGenerationRef.current;
        const accountSignal = accountAbortRef.current?.signal;
        const isStaleRequest = () => accountSignal?.aborted || requestGeneration !== accountGenerationRef.current;

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
                img.onerror = () => resolve(base64Str);
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
                                body: formData,
                                signal: accountSignal,
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

                    // Create attachment for display. Only images need a data URL
                    // for the preview/model; document blobs are parsed above and
                    // must not be copied into every conversation save.
                    if (!isImage) {
                        return {
                            id: crypto.randomUUID(),
                            name: file.name,
                            type: file.type || 'application/octet-stream',
                            url: '',
                            size: file.size,
                        };
                    }

                    return new Promise<Attachment>((resolve) => {
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
                        // Treat an unreadable preview as a non-fatal attachment
                        // problem. Rejecting here happened before sendMessage's
                        // network try/finally and could leave its in-flight lock
                        // stuck forever after a failed FileReader.
                        reader.onerror = () => resolve({
                            id: crypto.randomUUID(),
                            name: file.name,
                            type: file.type || 'application/octet-stream',
                            url: '',
                            size: file.size,
                        });
                        reader.readAsDataURL(file);
                    });
                })
            );
        }

        // Append document context to message if present
        const processedContent = documentContext
            ? content.trim() + documentContext
            : content.trim();

        // Auth can change while an attachment is being parsed. Do not let a
        // completed old request write a message into the next account.
        if (isStaleRequest()) {
            sendInFlightRef.current = false;
            return;
        }

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
                signal: accountSignal,
                body: JSON.stringify({
                    message: processedContent,
                    history: history.map(m => ({ role: m.role, content: m.content })),
                    attachments: messageAttachments,
                    webSearchEnabled,
                    model: selectedModel,
                    twinMode
                })
            });

            if (isStaleRequest()) return;

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
            let activeSources: Message['sources'];
            let activeActivityRunId: string | undefined;

            // SSE frames don't align with network chunk boundaries — see
            // lib/ai/sse-buffer.ts for why this needs a carry-over buffer.
            let sseBuffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (isStaleRequest()) return;

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
                                activeActivityRunId = json.meta.runId;
                                activeModelLabel = json.meta.label || activeModelLabel;
                                activeIntent = json.meta.intent;
                                activeFallback = !!json.meta.fallback;
                                activeSources = Array.isArray(json.meta.sources) ? json.meta.sources : undefined;
                                setStreamingMessage(prev => prev ? {
                                    ...prev,
                                    model: activeModelLabel,
                                    intent: activeIntent,
                                    fallback: activeFallback,
                                    sources: activeSources,
                                    activityRunId: activeActivityRunId,
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
                                    fallback: activeFallback,
                                    sources: activeSources,
                                    activityRunId: activeActivityRunId,
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

            if (isStaleRequest()) return;
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
                        // Structured replies can contain private journal or
                        // connector data; keep model output out of browser logs.

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
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Idempotency-Key': createClientIdempotencyKey(),
                                            },
                                            body: JSON.stringify({
                                                action: { ...action, payload: { ...action.payload, confirmed: true } }
                                            })
                                        });
                                        const execResult = await execResponse.json();
                                        if (execResult.code === 'Free plan monthly AI action limit reached') {
                                            window.dispatchEvent(new CustomEvent('novo:open-paywall', { detail: { source: 'limit' } }));
                                        }
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
                                        focusScore: p.focusTimeToday !== undefined ? Math.min(100, Math.round(p.focusTimeToday * 10)) : undefined,
                                        fatigueEstimate: p.fatigueEstimate,
                                        burnoutRisk: p.productivityScore !== undefined ? Math.round(100 - p.productivityScore) : undefined,
                                        energyLevel: p.fatigueEstimate ? (p.fatigueEstimate === 'low' ? 'alta' : p.fatigueEstimate === 'medium' ? 'media' : 'baja') : undefined,
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
                model: activeModelLabel,
                sources: activeSources,
            };

            if (isStaleRequest()) return;
            setConversations(prev => prev.map(c =>
                c.id === activeConversationId
                    ? {
                        ...c,
                        messages: [...c.messages, assistantMessage],
                        updatedAt: new Date().toISOString()
                    }
                    : c
            ));

        } catch {
            if (isStaleRequest()) return;
            const errMsg = 'No se pudo completar la solicitud.';
            setError(errMsg);
            console.error('[Chatbot] Send message failed.');
            setStreamingMessage(null);
            // Nothing in chat-area.tsx/chat-input.tsx renders context.error —
            // without this, a request that fails before/outside the stream
            // loop (network error, non-ok response) left the user's message
            // sitting with no reply and no visible failure at all.
            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `⚠️ ${errMsg} Intenta de nuevo.`,
                timestamp: new Date().toISOString(),
            };
            setConversations(prev => prev.map(c =>
                c.id === activeConversationId
                    ? { ...c, messages: [...c.messages, errorMessage], updatedAt: new Date().toISOString() }
                    : c
            ));
        } finally {
            if (!isStaleRequest()) {
                sendInFlightRef.current = false;
                setIsLoading(false);
                setIsTyping(false);
                setStatusMessage(null);
            }
        }
    }, [currentConversationId, selectedModel, twinMode]);

    const confirmAction = useCallback(async (messageId: string, blockId: string) => {
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (!conversation) return;

        const message = conversation.messages.find(m => m.id === messageId);
        if (!message || !message.blocks) return;

        const block = message.blocks.find(b => b.id === blockId);
        if (!block || block.type !== 'confirmation') return;

        const executionId = `${messageId}:${blockId}`;
        if (executingActionRef.current.has(executionId)) return;
        executingActionRef.current.add(executionId);
        const idempotencyKey = actionIntentKeysRef.current.get(executionId) ?? createClientIdempotencyKey();
        actionIntentKeysRef.current.set(executionId, idempotencyKey);
        const requestGeneration = accountGenerationRef.current;
        const accountSignal = accountAbortRef.current?.signal;
        const isStaleRequest = () => accountSignal?.aborted || requestGeneration !== accountGenerationRef.current;

        const updatedBlocks = message.blocks.map(b =>
            b.id === blockId ? { ...b, status: 'executing' as const } : b
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
            const response = await fetch('/api/ai/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
                signal: accountSignal,
                body: JSON.stringify({ action: confirmedAction })
            });

            if (isStaleRequest()) return;

            const result = await response.json();
            if (result.code === 'Free plan monthly AI action limit reached') {
                window.dispatchEvent(new CustomEvent('novo:open-paywall', { detail: { source: 'limit' } }));
            }
            const resultBlock: MessageBlock = {
                id: executingBlock.id,
                type: 'result',
                content: result.output,
                status: (result.success ? 'success' : 'failed') as any,
                metadata: result.metadata
            };

            const finalBlocks = updatedBlocks.map(b => {
                if (b.id === blockId) {
                    return { ...b, status: result.success ? ('confirmed' as const) : ('waiting' as const) };
                }
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
                            signal: accountSignal,
                            body: JSON.stringify({
                                message: `The user originally asked: "${originalRequest}". The system returned the following data from a SYSTEM_QUERY. Please present this data in a clean, formatted, and readable way using markdown. Highlight the most important/critical items. Do NOT create any action or JSON - just format the data nicely:\n\n${dataSummary}`,
                                history: conversation.messages.slice(-4).map(m => ({ role: m.role, content: m.content })),
                            })
                        });

                        if (isStaleRequest()) return;
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
                                    model: 'openai/gpt-oss-120b'
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
                    if (isStaleRequest()) return;
                    console.error('[Chatbot] Auto-follow-up error:', followUpError);
                    setIsLoading(false);
                    setIsTyping(false);
                    setStatusMessage(null);
                }
            }

        } catch {
            if (isStaleRequest()) return;
            console.error('[Chatbot] Action execution failed.');
            const errorBlock: MessageBlock = {
                id: executingBlock.id,
                type: 'result',
                content: 'Failed to execute action. Please try again.',
                status: 'failed' as const
            };
            const finalBlocks = [
                ...updatedBlocks.map(block => block.id === blockId ? { ...block, status: 'waiting' as const } : block),
                errorBlock,
            ];
            const finalMessages = conversation.messages.map(m =>
                m.id === messageId ? { ...m, blocks: finalBlocks } : m
            );
            updateConversation(currentConversationId!, { messages: finalMessages });
        } finally {
            executingActionRef.current.delete(executionId);
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
