import { classifyIntent } from './classifier';
import { buildUserContext } from './context-builder';
import { COGNITIVE_CORE_PROMPT, SYSTEM_AGENT_PROMPT } from './system-prompt';
import { AIResponse, AIAction } from './types';

export async function runAI(message: string, history: any[] = [], userId: string = 'demo-user-id'): Promise<AIResponse> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('GROQ_API_KEY is missing');
    }

    // 1. INTENT ENGINE
    const classification = classifyIntent(message);

    // 2. MEMORY LAYER
    const context = await buildUserContext(userId);
    const userContext = context.summary;

    // 3. COGNITIVE CORE (Model A)
    const now = new Date();
    const timeCtx = `Current Time: ${now.toLocaleTimeString('en-US')}\nCurrent Date: ${now.toLocaleDateString('en-US')}`;
    const finalPrompt = `${COGNITIVE_CORE_PROMPT}\n\n${userContext}\n\n${timeCtx}`;

    const coreResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: finalPrompt },
                ...history,
                { role: 'user', content: message }
            ],
            temperature: 0.6,
            max_tokens: 4096,
            stream: false
        })
    });

    if (!coreResponse.ok) {
        const errorText = await coreResponse.text();
        throw new Error(`Groq Core Error: ${errorText}`);
    }

    const coreJson = await coreResponse.json();
    let cognitiveCoreResponse = coreJson.choices?.[0]?.message?.content || '';

    // Clean <think> tags if present
    cognitiveCoreResponse = cognitiveCoreResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // 4. SYSTEM AGENT (Model B) if action is detected
    const actionIntents = ['TASK', 'ROUTINE', 'PROJECT', 'SYSTEM_META', 'CRITICAL_ACTION'];
    if (actionIntents.includes(classification.type)) {
        const agentResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: SYSTEM_AGENT_PROMPT },
                    { role: 'user', content: `User Message: ${message}\n\nAssistant Response (Context): ${cognitiveCoreResponse}` }
                ],
                temperature: 0.1,
                max_tokens: 1024,
                stream: false
            })
        });

        if (agentResponse.ok) {
            const agentJson = await agentResponse.json();
            const agentContent = agentJson.choices?.[0]?.message?.content || '';

            try {
                // Try to parse JSON from agent content
                const jsonMatch = agentContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);

                    if (parsed.action) {
                        const type = classification.type === 'CRITICAL_ACTION' ? 'CONFIRMATION_REQUIRED' : 'PROPOSAL';
                        return {
                            type: type as any,
                            action: parsed.action,
                            requiresConfirmation: true
                        };
                    }
                }
            } catch (e) {
                console.error('[Runner] Failed to parse agent JSON:', e);
            }
        }
    }

    // 5. Default to MESSAGE
    return {
        type: 'MESSAGE',
        content: cognitiveCoreResponse
    };
}
