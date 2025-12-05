/**
 * Chutes AI API integration
 * https://docs.chutes.ai
 */

const CHUTES_API_URL = 'https://llm.chutes.ai/v1/chat/completions';

interface ChutesMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChutesResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export const chutesAPI = {
    async generateResponse(
        message: string,
        context: string,
        history: ChutesMessage[] = [],
        systemPrompt?: string,
        model: string = 'openai/gpt-oss-20b'
    ): Promise<{ content: string; functionCalls: any[] }> {
        const apiKey = process.env.CHUTES_API_TOKEN;

        if (!apiKey) {
            throw new Error('CHUTES_API_TOKEN no está configurado');
        }

        // Build messages array
        const messages: ChutesMessage[] = [];

        // Add system prompt if provided
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        // Add history
        messages.push(...history);

        // Add current message
        messages.push({
            role: 'user',
            content: message
        });

        try {
            console.log('Chutes API: Sending request', {
                model,
                messagesCount: messages.length,
                apiUrl: CHUTES_API_URL
            });

            const response = await fetch(CHUTES_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages,
                    max_tokens: 1024,
                    temperature: 0.7,
                    stream: false
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Chutes API error:', errorText);
                throw new Error(`Chutes API error: ${response.status} - ${errorText}`);
            }

            const data: ChutesResponse = await response.json();

            console.log('Chutes API: Response received', {
                model: data.model,
                tokensUsed: data.usage?.total_tokens || 0
            });

            const content = data.choices[0]?.message?.content || '';

            return {
                content,
                functionCalls: [] // Chutes doesn't support function calling yet
            };
        } catch (error) {
            console.error('Error in Chutes API:', error);
            throw error;
        }
    }
};
