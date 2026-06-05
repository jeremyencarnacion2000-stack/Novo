import { ConversationMessage } from '@/types/ai';

export interface GroqAPIResponse {
    choices: Array<{
        message: {
            content: string;
            role: string;
        };
        finish_reason: string;
    }>;
}

export class GroqAPIClient {
    private static instance: GroqAPIClient;
    private baseUrl = 'https://api.groq.com/openai/v1';

    private constructor() { }

    static getInstance(): GroqAPIClient {
        if (!GroqAPIClient.instance) {
            GroqAPIClient.instance = new GroqAPIClient();
        }
        return GroqAPIClient.instance;
    }

    async generateResponse(
        message: string,
        context: string,
        history: ConversationMessage[] = [],
        systemPrompt?: string,
        model: string = 'qwen-2.5-coder-32b',
        temperature: number = 0.7
    ): Promise<{ content: string }> {
        const apiKey = process.env.GROQ_API_KEY;

        console.log('Groq API: Key present:', !!apiKey);

        if (!apiKey) {
            throw new Error('GROQ_API_KEY is missing');
        }

        // Build messages array
        const messages: Array<{ role: string; content: string }> = [];

        // Add system prompt
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        // Add history (already normalized)
        if (Array.isArray(history) && history.length > 0) {
            history.forEach(h => {
                messages.push({
                    role: h.role,
                    content: h.content
                });
            });
        }

        // Add current message
        messages.push({
            role: 'user',
            content: message
        });

        try {
            console.log('Groq API: Sending request', {
                messageCount: messages.length,
                model
            });

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature,
                    max_tokens: 4096,
                    top_p: 0.95,
                    stream: false
                })
            });

            console.log('Groq API: Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Groq API error:', errorText);
                throw new Error(`Groq API error: ${response.status} - ${errorText}`);
            }

            const data: GroqAPIResponse = await response.json();

            if (!data.choices || data.choices.length === 0) {
                throw new Error('No response from Groq API');
            }

            const content = data.choices[0].message.content || '';

            console.log('Groq API: Response received, length:', content.length);

            return { content };
        } catch (error) {
            console.error('Groq API error:', error);
            throw error;
        }
    }

    async getModels(): Promise<string[]> {
        return [
            'qwen-2.5-coder-32b',
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'mixtral-8x7b-32768',
            'gemma2-9b-it'
        ];
    }
}

export const groqAPI = GroqAPIClient.getInstance();
