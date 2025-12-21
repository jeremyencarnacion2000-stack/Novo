'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ChatbotContextType, Conversation, Message, AIModel, FileAttachment, MessageBlock, Attachment } from './types';

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
    const [selectedModel, setSelectedModel] = useState('qwen-max');
    const [isLoading, setIsLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const availableModels: AIModel[] = [
        {
            id: 'qwen-max',
            name: 'Qwen Max (Alibaba)',
            provider: 'Alibaba Cloud',
            description: 'Most capable Qwen model',
            enabled: true
        },
        {
            id: 'qwen-plus',
            name: 'Qwen Plus (Alibaba)',
            provider: 'Alibaba Cloud',
            description: 'Balanced performance and speed',
            enabled: true
        },
        {
            id: 'grok-beta',
            name: 'Grok Beta',
            provider: 'xAI',
            description: 'Advanced AI model by xAI',
            enabled: true
        },
        {
            id: 'qwen/qwen3-235b-a22b:free',
            name: 'Qwen 3 (OpenRouter)',
            provider: 'OpenRouter',
            description: 'Advanced thinking model by Qwen via OpenRouter',
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

    // Load from database on mount
    useEffect(() => {
        async function loadConversations() {
            try {
                const response = await fetch('/api/ai-conversations');
                if (response.ok) {
                    const dbConversations = await response.json();
                    if (dbConversations.length > 0) {
                        const formattedConversations = dbConversations.map((conv: any) => ({
                            id: conv.id,
                            title: conv.title || 'Nueva conversación',
                            messages: Array.isArray(conv.messages) ? conv.messages.map((m: any) => ({
                                id: m.id || crypto.randomUUID(),
                                role: m.role,
                                content: m.content,
                                timestamp: m.timestamp || m.createdAt || new Date().toISOString(),
                                model: m.model || 'grok-beta',
                                attachments: m.attachments
                            })) : [],
                            createdAt: conv.createdAt,
                            updatedAt: conv.updatedAt,
                            model: conv.model || 'grok-beta'
                        }));
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
            setSelectedModel(storedModel);
        }
    }, []);

    // Save conversations to database when they change
    useEffect(() => {
        async function saveToDatabase() {
            if (conversations.length === 0) return;

            for (const conv of conversations) {
                try {
                    const response = await fetch(`/api/ai-conversations/${conv.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: conv.title,
                            messages: conv.messages,
                            model: conv.model
                        })
                    });

                    if (response.status === 404) {
                        const createResponse = await fetch('/api/ai-conversations', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                title: conv.title,
                                messages: conv.messages,
                                model: conv.model
                            })
                        });

                        if (createResponse.ok) {
                            const newConv = await createResponse.json();
                            setConversations(prev => prev.map(c =>
                                c.id === conv.id ? { ...c, id: newConv.id } : c
                            ));
                            if (currentConversationId === conv.id) {
                                setCurrentConversationId(newConv.id);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Failed to save conversation to database:', error);
                }
            }
        }

        const timeoutId = setTimeout(saveToDatabase, 1000);
        return () => clearTimeout(timeoutId);
    }, [conversations, currentConversationId]);

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

    const deleteConversation = useCallback(async (id: string) => {
        setConversations(prev => {
            const filtered = prev.filter(c => c.id !== id);
            if (currentConversationId === id && filtered.length > 0) {
                setCurrentConversationId(filtered[0].id);
            } else if (filtered.length === 0) {
                setCurrentConversationId(null);
            }
            return filtered;
        });

        try {
            await fetch(`/api/ai-conversations/${id}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('Failed to delete conversation:', error);
        }
    }, [currentConversationId]);

    const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
        setConversations(prev => prev.map(c =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        ));
    }, []);

    const sendMessage = useCallback(async (content: string, files?: File[], webSearchEnabled?: boolean) => {
        if (!content.trim() || !currentConversationId) return;

        // Convert files to attachments for persistence
        let messageAttachments: Attachment[] = [];
        if (files && files.length > 0) {
            messageAttachments = await Promise.all(
                files.map(async (file) => {
                    return new Promise<Attachment>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve({
                            id: crypto.randomUUID(),
                            name: file.name,
                            type: file.type,
                            url: reader.result as string,
                            size: file.size
                        });
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                })
            );
        }

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date().toISOString(),
            model: selectedModel,
            attachments: messageAttachments.length > 0 ? messageAttachments : undefined
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
            const response = await fetch('/api/ai/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: content,
                    history: messages.map(m => ({ role: m.role, content: m.content })),
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
                model: 'qwen3-32b'
            });

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const json = JSON.parse(data);
                            if (json.content) {
                                accumulatedContent += json.content;
                                setStreamingMessage({
                                    id: streamingMsgId,
                                    role: 'assistant',
                                    content: accumulatedContent,
                                    timestamp: new Date().toISOString(),
                                    model: 'qwen3-32b'
                                });
                            }
                        } catch (e) {}
                    }
                }
            }

            setStreamingMessage(null);

            let finalContent = accumulatedContent;
            let blocks: MessageBlock[] = [];

            try {
                let jsonStr = '';
                const jsonBlockMatch = accumulatedContent.match(/```json\s*([\s\S]*?)\s*```/);
                const genericBlockMatch = accumulatedContent.match(/```\s*([\s\S]*?)\s*```/);
                const rawJsonMatch = accumulatedContent.match(/({[\s\S]*})/);

                if (jsonBlockMatch) jsonStr = jsonBlockMatch[1];
                else if (genericBlockMatch && genericBlockMatch[1].trim().startsWith('{')) jsonStr = genericBlockMatch[1];
                else if (rawJsonMatch) jsonStr = rawJsonMatch[1];
                else jsonStr = accumulatedContent.trim();

                const parsed = JSON.parse(jsonStr);
                if (parsed.message || parsed.analysis || parsed.plan) {
                    finalContent = parsed.message || '';
                    if (parsed.analysis) blocks.push({ id: crypto.randomUUID(), type: 'analysis', content: parsed.analysis });
                    if (parsed.plan) blocks.push({ id: crypto.randomUUID(), type: 'plan', content: parsed.plan });
                    if (parsed.action) blocks.push({ id: crypto.randomUUID(), type: 'confirmation', content: parsed.action, status: 'pending' });
                }
            } catch (e) {}

            const assistantMessage: Message = {
                id: streamingMsgId,
                role: 'assistant',
                content: finalContent,
                blocks: blocks.length > 0 ? blocks : undefined,
                timestamp: new Date().toISOString(),
                model: 'qwen3-32b'
            };

            updateConversation(currentConversationId, {
                messages: [...messages, userMessage, assistantMessage]
            });

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
            console.error('Send message error:', err);
        } finally {
            setIsLoading(false);
            setIsTyping(false);
            setStatusMessage(null);
        }
    }, [currentConversationId, messages, selectedModel, updateConversation]);

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
            const response = await fetch('/api/ai/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: block.content })
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
                if (b.type === 'plan') {
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
        likeMessage,
        dislikeMessage,
        confirmAction,
        cancelAction,
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
        statusMessage,
        error
    };

    return (
        <ChatbotContext.Provider value={value}>
            {children}
        </ChatbotContext.Provider>
    );
}
