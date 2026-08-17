import { ConversationMessage } from '@/types/ai';

export interface GroqAPIResponse {
    choices: Array<{
        message: {
            content: string;
            role: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
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
        // qwen/qwen3-32b, llama-3.3-70b-versatile and llama-3.1-8b-instant were
        // all decommissioned on this Groq account (verified 2026-08-17 via
        // GET /v1/models: catalog is now the gpt-oss family + qwen3.6).
        // openai/gpt-oss-120b answered live probes on the production key.
        model: string = 'openai/gpt-oss-120b',
        temperature: number = 0.7
    ): Promise<{ content: string; tokensIn?: number; tokensOut?: number }> {
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
                    stream: false,
                    // Only qwen3 models are reasoning models that emit a
                    // <think>...</think> trace as literal content — sending
                    // this param to any other model (llama, gpt-oss, etc.)
                    // is a 400 "reasoning_format is not supported with this
                    // model", which took down every non-qwen3 caller of this
                    // client the first time it shipped unconditionally.
                    ...(model.includes('qwen3') ? { reasoning_format: 'hidden' } : {})
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

            // Defensive strip: if reasoning_format:'hidden' isn't honored for this
            // model, don't let the raw <think> trace leak into the user-facing chat.
            const content = (data.choices[0].message.content || '')
                .replace(/<think>[\s\S]*?<\/think>/gi, '')
                .trim();

            console.log('Groq API: Response received, length:', content.length);

            return {
                content,
                tokensIn: data.usage?.prompt_tokens,
                tokensOut: data.usage?.completion_tokens,
            };
        } catch (error) {
            console.error('Groq API error:', error);
            throw error;
        }
    }

    async getModels(): Promise<string[]> {
        // Mirrors the live catalog of this Groq account (GET /v1/models,
        // verified 2026-08-17) — the llama/mixtral/gemma ids were retired.
        return [
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b',
            'qwen/qwen3.6-27b'
        ];
    }
}

export const groqAPI = GroqAPIClient.getInstance();
