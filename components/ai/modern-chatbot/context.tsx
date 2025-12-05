'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ChatbotContextType, Conversation, Message, AIModel, FileAttachment } from './types';

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

export function ChatbotProvider({ children }: { children: React.ReactNode }) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [artifactsPanelCollapsed, setArtifactsPanelCollapsed] = useState(true);
    const [selectedModel, setSelectedModel] = useState('grok-beta');
    const [isLoading, setIsLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);

    const availableModels: AIModel[] = [
        {
            id: 'grok-beta',
            name: 'Grok Beta',
            provider: 'xAI',
            description: 'Advanced AI model by xAI',
            enabled: true
        },
        {
            id: 'qwen3-next-80b',
            name: 'Qwen3-Next-80B',
            provider: 'Hugging Face',
            description: 'Advanced thinking model by Qwen',
            enabled: true
        },
        {
            id: 'gemma-3-4b',
            name: 'Gemma 3 4B',
            provider: 'Chutes AI',
            description: 'Efficient Gemma model via Chutes',
            enabled: true
        },
        {
            id: 'chutes/openai/gpt-oss-20b',
            name: 'GPT OSS 20B',
            provider: 'Chutes',
            description: 'Open source GPT model',
            enabled: true
        }
    ];

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setConversations(parsed);
                if (parsed.length > 0) {
                    setCurrentConversationId(parsed[0].id);
                }
            } catch (e) {
                console.error('Failed to load conversations:', e);
            }
        }

        const sidebarState = localStorage.getItem(SIDEBAR_KEY);
        if (sidebarState) {
            setSidebarCollapsed(sidebarState === 'true');
        }

        const storedModel = localStorage.getItem(MODEL_KEY);
        if (storedModel) {
            setSelectedModel(storedModel);
        }
    }, []);

    // Save to localStorage when conversations change
    useEffect(() => {
        if (conversations.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
        }
    }, [conversations]);

    // Save sidebar state
    useEffect(() => {
        localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.toString());
    }, [sidebarCollapsed]);

    // Save model selection
    useEffect(() => {
        localStorage.setItem(MODEL_KEY, selectedModel);
    }, [selectedModel]);

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

    const deleteConversation = useCallback((id: string) => {
        setConversations(prev => {
            const filtered = prev.filter(c => c.id !== id);
            if (currentConversationId === id && filtered.length > 0) {
                setCurrentConversationId(filtered[0].id);
            } else if (filtered.length === 0) {
                setCurrentConversationId(null);
            }
            return filtered;
        });
    }, [currentConversationId]);

    const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
        setConversations(prev => prev.map(c =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        ));
    }, []);

    const sendMessage = useCallback(async (content: string, files?: File[]) => {
        if (!content.trim() || !currentConversationId) return;

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date().toISOString(),
            model: selectedModel
        };

        // Add user message
        updateConversation(currentConversationId, {
            messages: [...messages, userMessage]
        });

        // Update title if first message
        if (messages.length === 0) {
            const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
            updateConversation(currentConversationId, { title });
        }

        setIsLoading(true);
        setIsTyping(true);
        setError(null);

        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: content,
                    history: messages,
                    systemPrompt: 'Eres un asistente útil y profesional que puede ayudar a gestionar tareas, proyectos y rutinas. Responde en español de manera clara y concisa. Cuando el usuario te pida crear una tarea, proyecto o rutina, usa las herramientas disponibles para hacerlo.',
                    tools: [
                        {
                            type: 'function',
                            function: {
                                name: 'create_task',
                                description: 'Crear una nueva tarea en el sistema',
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string', description: 'Título de la tarea' },
                                        status: { type: 'string', enum: ['todo', 'in-progress', 'done'], description: 'Estado de la tarea' },
                                        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Prioridad de la tarea' },
                                        dueDate: { type: 'string', description: 'Fecha de vencimiento en formato ISO' },
                                        projectId: { type: 'string', description: 'ID del proyecto asociado' },
                                        tags: { type: 'array', items: { type: 'string' }, description: 'Etiquetas de la tarea' }
                                    },
                                    required: ['title']
                                }
                            }
                        },
                        {
                            type: 'function',
                            function: {
                                name: 'create_project',
                                description: 'Crear un nuevo proyecto en el sistema',
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string', description: 'Título del proyecto' },
                                        description: { type: 'string', description: 'Descripción del proyecto' },
                                        status: { type: 'string', enum: ['not-started', 'in-progress', 'completed'], description: 'Estado del proyecto' },
                                        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Prioridad del proyecto' },
                                        dueDate: { type: 'string', description: 'Fecha de vencimiento en formato ISO' },
                                        tags: { type: 'array', items: { type: 'string' }, description: 'Etiquetas del proyecto' }
                                    },
                                    required: ['title']
                                }
                            }
                        },
                        {
                            type: 'function',
                            function: {
                                name: 'create_routine',
                                description: 'Crear una nueva rutina en el sistema',
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string', description: 'Nombre de la rutina' },
                                        description: { type: 'string', description: 'Descripción de la rutina' },
                                        timeOfDay: { type: 'string', enum: ['morning', 'afternoon', 'evening', 'night'], description: 'Momento del día para la rutina' },
                                        duration: { type: 'number', description: 'Duración en minutos' }
                                    },
                                    required: ['name', 'timeOfDay', 'duration']
                                }
                            }
                        }
                    ],
                    model: selectedModel
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }

            const data = await response.json();
            const fullContent = data.content;

            // Stop typing indicator
            setIsTyping(false);

            // Create streaming message with ULTRA-FAST animation
            const messageId = crypto.randomUUID();
            const baseMessage: Message = {
                id: messageId,
                role: 'assistant',
                content: '',
                timestamp: new Date().toISOString(),
                model: selectedModel
            };

            // Ultra-fast streaming effect (1-3ms per word)
            const words = fullContent.split(' ');
            let currentText = '';

            for (let i = 0; i < words.length; i++) {
                currentText += (i > 0 ? ' ' : '') + words[i];
                setStreamingMessage({
                    ...baseMessage,
                    content: currentText
                });

                // Ultra-fast delay (1-3ms per word for smooth effect)
                const delay = words.length > 100 ? 1 : 3;
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Final message
            const assistantMessage: Message = {
                ...baseMessage,
                content: fullContent
            };

            // Clear streaming and add final message
            setStreamingMessage(null);
            updateConversation(currentConversationId, {
                messages: [...messages, userMessage, assistantMessage]
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
            console.error('Send message error:', err);
            setStreamingMessage(null);
        } finally {
            setIsLoading(false);
            setIsTyping(false);
        }
    }, [currentConversationId, messages, selectedModel, updateConversation]);

    const retryMessage = useCallback(async (messageId: string) => {
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1 || messageIndex === 0) return;

        const userMessage = messages[messageIndex - 1];
        if (userMessage.role !== 'user') return;

        // Remove the old assistant message
        const newMessages = messages.slice(0, messageIndex);
        updateConversation(currentConversationId!, { messages: newMessages });

        // Resend
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
        likeMessage,
        dislikeMessage,
        sidebarCollapsed,
        setSidebarCollapsed,
        artifactsPanelCollapsed,
        setArtifactsPanelCollapsed,
        selectedModel,
        setSelectedModel,
        availableModels,
        isLoading,
        isTyping,
        streamingMessage,
        error
    };

    return (
        <ChatbotContext.Provider value={value}>
            {children}
        </ChatbotContext.Provider>
    );
}
