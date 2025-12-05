// Hugging Face API Integration
const HF_BASE_URL = 'https://router.huggingface.co/v1';

export const huggingFaceAPI = {
    generateResponse: async (
        message: string,
        conversationId?: string,
        history: any[] = [],
        systemPrompt?: string,
        model: string = 'Qwen/Qwen3-Next-80B-A3B-Thinking:novita'
    ) => {
        const HF_TOKEN = process.env.HF_TOKEN;

        if (!HF_TOKEN) {
            throw new Error('HF_TOKEN environment variable is not set');
        }

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

        console.log('Hugging Face API: Sending request', {
            model,
            messageCount: messages.length,
            lastMessage: message.slice(0, 100)
        });

        try {
            const response = await fetch(`${HF_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: 0.7,
                    max_tokens: 2048,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Hugging Face API error:', errorText);
                throw new Error(`Hugging Face API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            console.log('Hugging Face API: Response received', {
                model: data.model,
                usage: data.usage
            });

            const content = data.choices?.[0]?.message?.content || '';

            return {
                content,
                functionCalls: [] // HF doesn't support function calls in this basic integration
            };
        } catch (error) {
            console.error('Error calling Hugging Face API:', error);
            throw error;
        }
    }
};
