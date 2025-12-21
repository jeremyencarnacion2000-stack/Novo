// Alibaba Cloud DashScope API Integration
const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/api/v1';
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '***REMOVED***';

export const dashscopeAPI = {
    generateResponse: async (
        message: string,
        conversationId?: string,
        history: any[] = [],
        systemPrompt?: string,
        model: string = 'qwen-max'
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
                // DashScope expects 'user' or 'assistant' roles, map if necessary
                let role = msg.role;
                if (role !== 'user' && role !== 'assistant' && role !== 'system') {
                    role = 'user'; // Fallback
                }

                // Filter out empty content which DashScope might reject
                if (msg.content && typeof msg.content === 'string' && msg.content.trim() !== '') {
                    messages.push({
                        role: role,
                        content: msg.content
                    });
                }
            });
        }

        // Add current message
        messages.push({
            role: 'user',
            content: message
        });

        console.log('DashScope API: Sending request', {
            model,
            messageCount: messages.length,
            lastMessage: message.slice(0, 100)
        });

        try {
            const response = await fetch(`${DASHSCOPE_BASE_URL}/services/aigc/text-generation/generation`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    input: {
                        messages: messages
                    },
                    parameters: {
                        result_format: 'message',
                        temperature: 0.7,
                        // enable_search: true // Optional: enable web search if needed
                    }
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('DashScope API error:', errorText);
                throw new Error(`DashScope API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.code && data.code !== '') {
                console.error('DashScope API returned error code:', data);
                throw new Error(`DashScope API error: ${data.message || data.code}`);
            }

            console.log('DashScope API: Response received', {
                requestId: data.request_id,
                usage: data.usage
            });

            const content = data.output?.choices?.[0]?.message?.content || '';

            return {
                content,
                functionCalls: []
            };
        } catch (error) {
            console.error('Error calling DashScope API:', error);
            throw error;
        }
    }
};
