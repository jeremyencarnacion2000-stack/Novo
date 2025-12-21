// Types for Modern Chatbot
export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    model?: string;
    liked?: boolean;
    disliked?: boolean;
    artifacts?: Artifact[];
    blocks?: MessageBlock[];
    attachments?: Attachment[];
}

export interface Attachment {
    id: string;
    name: string;
    type: string;
    url: string; // Base64 or URL
    size?: number;
}

export type BlockType = 'text' | 'analysis' | 'plan' | 'confirmation' | 'result';

export interface MessageBlock {
    id: string;
    type: BlockType;
    title?: string;
    content: any;
    status?: 'pending' | 'success' | 'failed' | 'waiting' | 'waiting_confirmation' | 'confirmed' | 'cancelled';
    isVisible?: boolean;
    actionId?: string;
    metadata?: any;
}

export interface PlanItem {
    id: string;
    label: string;
    description?: string;
    status: 'pending' | 'success' | 'failed' | 'skipped';
}

export interface ExecutionResult {
    success: boolean;
    output: string;
    metadata?: any;
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: string;
    updatedAt: string;
    model?: string;
}

export interface Artifact {
    id: string;
    type: 'code' | 'image' | 'document' | 'data';
    title: string;
    content: string;
    language?: string;
}

export interface AIModel {
    id: string;
    name: string;
    provider: string;
    description: string;
    enabled: boolean;
}

export interface ChatbotContextType {
    // Conversations
    conversations: Conversation[];
    currentConversationId: string | null;
    setCurrentConversationId: (id: string | null) => void;
    createConversation: () => void;
    deleteConversation: (id: string) => void;
    updateConversation: (id: string, updates: Partial<Conversation>) => void;

    // Messages
    messages: Message[];
    sendMessage: (content: string, files?: File[], webSearchEnabled?: boolean) => Promise<void>;
    retryMessage: (messageId: string) => Promise<void>;
    likeMessage: (messageId: string) => void;
    dislikeMessage: (messageId: string) => void;
    confirmAction: (messageId: string, blockId: string) => void;
    cancelAction: (messageId: string, blockId: string) => void;

    // UI State
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (collapsed: boolean) => void;
    artifactsPanelCollapsed: boolean;
    setArtifactsPanelCollapsed: (collapsed: boolean) => void;

    // Model Selection
    selectedModel: string;
    setSelectedModel: (modelId: string) => void;
    availableModels: AIModel[];

    // Loading states
    isLoading: boolean;
    isTyping: boolean;
    streamingMessage: Message | null;
    statusMessage: string | null;
    error: string | null;
}

export interface FileAttachment {
    id: string;
    file: File;
    preview?: string;
    type: 'image' | 'document' | 'other';
}
