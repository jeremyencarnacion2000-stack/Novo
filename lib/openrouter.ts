// OpenRouter API Integration
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY env var is not set')

export const openRouterAPI = {
    generateResponse: async (
        message: string,
        conversationId?: string,
        history: any[] = [],
        systemPrompt?: string,
        model: string = 'qwen/qwen3-235b-a22b:free'
    ) => {
        // Build messages array
        const messages: any[] = [];

        // Add system prompt if provided
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        // Add history
        if (history && history.length > 0) {
            history.forEach((msg: any) => {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }

        // Add current message
        messages.push({
            role: 'user',
            content: message
        });

        console.log('OpenRouter API: Sending request', {
            model,
            messageCount: messages.length,
            lastMessage: message.slice(0, 100)
        });

        try {
            const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000', // Site URL for rankings on openrouter.ai.
                    'X-Title': 'Novo Desktop', // Site title for rankings on openrouter.ai.
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: 0.7,
                    // max_tokens: 2048, // Optional, let the model decide or use default
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('OpenRouter API error:', errorText);
                throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            console.log('OpenRouter API: Response received', {
                model: data.model,
                usage: data.usage
            });

            const content = data.choices?.[0]?.message?.content || '';

            return {
                content,
                functionCalls: []
            };
        } catch (error) {
            console.error('Error calling OpenRouter API:', error);
            throw error;
        }
    }
};
