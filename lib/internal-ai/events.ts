import { AIEvent } from './types';

type EventHandler = (event: AIEvent) => void;

class InternalAIEventBus {
    private static instance: InternalAIEventBus;
    private handlers: EventHandler[] = [];
    private history: AIEvent[] = [];
    private readonly MAX_HISTORY = 100;

    private constructor() { }

    public static getInstance(): InternalAIEventBus {
        if (!InternalAIEventBus.instance) {
            InternalAIEventBus.instance = new InternalAIEventBus();
        }
        return InternalAIEventBus.instance;
    }

    public subscribe(handler: EventHandler): () => void {
        this.handlers.push(handler);
        return () => {
            this.handlers = this.handlers.filter(h => h !== handler);
        };
    }

    public emit(event: AIEvent): void {
        // Add to history
        this.history.unshift(event);
        if (this.history.length > this.MAX_HISTORY) {
            this.history.pop();
        }

        // Notify subscribers
        this.handlers.forEach(handler => {
            try {
                handler(event);
            } catch (error) {
                console.error('Error in AI event handler:', error);
            }
        });

        // Log to console in dev
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Internal AI] ${event.type}`, event);
        }
    }

    public getHistory(): AIEvent[] {
        return [...this.history];
    }

    public clearHistory(): void {
        this.history = [];
    }
}

export const aiEventBus = InternalAIEventBus.getInstance();
