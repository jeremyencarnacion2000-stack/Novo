import { NextRequest } from 'next/server';
import { groqAPI } from '@/lib/groq';
import { SYSTEM_PROMPT, COGNITIVE_CORE_PROMPT, SYSTEM_AGENT_PROMPT, HYBRID_PROMPT } from '@/lib/ai/system-prompt';
import { classifyIntent, requiresSystemContext } from '@/lib/ai/classifier';
import { buildUserContext } from '@/lib/ai/context-builder';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';

// Normalize history
function normalizeHistory(history: any[]): any[] {
    if (!history?.length) return [];
    const normalized: any[] = [];
    let lastRole = '';
    for (const msg of history) {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        if (role === lastRole) continue;
        normalized.push({ role, content: msg.content || '' });
        lastRole = role;
    }
    if (normalized.length > 0 && normalized[0].role !== 'user') normalized.shift();
    return normalized;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id || 'demo-user-id';
        const { message, history } = await request.json();

        if (!message) {
            return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
        }

        // Classify Intent
        const classification = classifyIntent(message);
        console.log('[Stream] Intent:', classification.type);

        // Build Context
        let userContext = '';
        if (requiresSystemContext(classification)) {
            try {
                const context = await buildUserContext(userId);
                userContext = context.summary;
            } catch (e) { console.error('[Stream] Context error:', e); }
        }

        // Select Prompt
        let selectedPrompt: string;
        switch (classification.type) {
            case 'GENERAL_KNOWLEDGE':
                selectedPrompt = COGNITIVE_CORE_PROMPT;
                break;
            case 'SYSTEM_ACTION':
            case 'SYSTEM_QUERY':
                selectedPrompt = SYSTEM_AGENT_PROMPT;
                break;
            case 'MIXED':
                selectedPrompt = HYBRID_PROMPT;
                break;
            default:
                selectedPrompt = SYSTEM_PROMPT;
        }

        // Build final prompt
        const now = new Date();
        const timeCtx = `Time: ${now.toLocaleTimeString('en-US')}\nDate: ${now.toLocaleDateString('en-US')}`;
        const finalPrompt = `${selectedPrompt}\n\nCONTEXT:\n${timeCtx}\n${userContext}`;

        // Prepare messages
        const cleanHistory = normalizeHistory(history || []);
        const messages: Array<{ role: string; content: string }> = [
            { role: 'system', content: finalPrompt },
            ...cleanHistory,
            { role: 'user', content: message }
        ];

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'GROQ_API_KEY missing' }), { status: 500 });
        }

        // Call Groq with streaming
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'qwen/qwen3-32b',
                messages,
                temperature: 0.7,
                max_tokens: 4096,
                stream: true
            })
        });

        if (!groqResponse.ok) {
            const error = await groqResponse.text();
            return new Response(JSON.stringify({ error: `Groq error: ${error}` }), { status: 500 });
        }

        // Stream the response
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                const reader = groqResponse.body?.getReader();
                if (!reader) {
                    controller.close();
                    return;
                }

                const decoder = new TextDecoder();
                let buffer = '';

                try {
                    let insideThink = false;

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = line.slice(6);
                                if (data === '[DONE]') continue;

                                try {
                                    const json = JSON.parse(data);
                                    let content = json.choices?.[0]?.delta?.content || '';

                                    // Filter out <think> tags and their content
                                    if (content.includes('<think>')) {
                                        insideThink = true;
                                        content = content.replace(/<think>/g, '');
                                    }
                                    if (content.includes('</think>')) {
                                        insideThink = false;
                                        content = content.replace(/<\/think>/g, '');
                                    }

                                    // Skip content inside think tags
                                    if (insideThink) continue;

                                    // Remove any remaining think tags
                                    content = content.replace(/<\/?think>/g, '');

                                    if (content) {
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                                    }
                                } catch (e) {
                                    // Skip malformed JSON
                                }
                            }
                        }
                    }
                } finally {

                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                }
            }
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (error) {
        console.error('[Stream] Error:', error);
        return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
    }
}
