// Cerebras Cloud API Integration — OpenAI-compatible chat completions.
// Added as a fast, independent-quota fallback tier to replace the fallback
// rungs that turned out to be dead (Grok: xAI account out of credits;
// DashScope: invalid API key — see app/api/ai/generate/route.ts).
const CEREBRAS_BASE_URL = 'https://api.cerebras.ai/v1';
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
if (!CEREBRAS_API_KEY) throw new Error('CEREBRAS_API_KEY env var is not set');

export const cerebrasAPI = {
    generateResponse: async (
        message: string,
        conversationId?: string,
        history: any[] = [],
        systemPrompt?: string,
        // Verified live against GET /v1/models 2026-07-17 — this account's
        // available models are gemma-4-31b, zai-glm-4.7, gpt-oss-120b only
        // (no llama-3.x on this tier). gpt-oss-120b is the most capable
        // general-purpose option of the three.
        model: string = 'gpt-oss-120b',
        temperature: number = 0.7
    ) => {
        const messages: any[] = [];

        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        if (history && history.length > 0) {
            history.forEach((msg: any) => {
                messages.push({ role: msg.role, content: msg.content });
            });
        }

        messages.push({ role: 'user', content: message });

        console.log('Cerebras API: Sending request', {
            model,
            messageCount: messages.length,
            lastMessage: message.slice(0, 100)
        });

        try {
            const response = await fetch(`${CEREBRAS_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Cerebras API error:', errorText);
                throw new Error(`Cerebras API error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';

            return { content, functionCalls: [] };
        } catch (error) {
            console.error('Error calling Cerebras API:', error);
            throw error;
        }
    }
};
