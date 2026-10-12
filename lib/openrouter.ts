// OpenRouter API Integration
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Resolve credentials only when a request is made. Throwing at module import
// time makes Next.js fail while collecting route data in environments where
// the optional provider is intentionally disabled (for example a Preview).
function getOpenRouterApiKey(): string {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY env var is not set');
    return apiKey;
}

export const openRouterAPI = {
    generateResponse: async (
        message: string,
        conversationId?: string,
        history: any[] = [],
        systemPrompt?: string,
        // qwen3-235b-a22b:free was discontinued by OpenRouter (404: "unavailable
        // for free, use qwen/qwen3-235b-a22b instead" — the paid version, which
        // would silently start incurring real cost). Verified live 2026-07-16:
        // OpenRouter's free tier is backed by multiple upstream providers with
        // independent capacity — "Venice"-hosted free models (qwen3-coder,
        // llama-3.2/3.3) were consistently 429 (shared-capacity saturation,
        // not a code problem), while openai/gpt-oss-20b:free (different
        // upstream) responded 200 on every attempt. Re-verify if this one
        // ever starts failing — check response body for the provider_name
        // before assuming the fix regressed.
        model: string = 'openai/gpt-oss-20b:free'
    ) => {
        const apiKey = getOpenRouterApiKey();
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

        try {
            const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
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
                // Provider bodies can contain prompt fragments or account
                // diagnostics. Keep them out of logs and client-facing errors.
                await response.arrayBuffer().catch(() => undefined);
                console.error('OpenRouter API request failed', { status: response.status });
                throw new Error('openrouter_provider_unavailable');
            }

            const data = await response.json();

            const content = data.choices?.[0]?.message?.content || '';

            return {
                content,
                functionCalls: []
            };
        } catch (error) {
            console.error('OpenRouter API request failed', {
                reason: error instanceof Error ? error.name : 'unknown',
            });
            throw error;
        }
    }
};
