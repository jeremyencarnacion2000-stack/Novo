import { NextRequest } from 'next/server';
import { groqAPI } from '@/lib/groq';
import { SYSTEM_PROMPT, COGNITIVE_CORE_PROMPT, SYSTEM_AGENT_PROMPT, HYBRID_PROMPT } from '@/lib/ai/system-prompt';
import { classifyIntent, requiresSystemContext } from '@/lib/ai/classifier';
import { buildUserContext } from '@/lib/ai/context-builder';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';

// Normalize history and prevent token limit issues
function normalizeHistory(history: any[]): any[] {
    if (!history?.length) return [];

    // Limit to last 10 messages to keep context window manageable
    const recentHistory = history.slice(-10);
    const normalized: any[] = [];
    let lastRole = '';

    for (const msg of recentHistory) {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        if (role === lastRole) continue;

        // Truncate extremely long messages (max 2000 chars per history message)
        let content = msg.content || '';
        if (content.length > 2000) {
            content = content.substring(0, 2000) + '... [truncated]';
        }

        normalized.push({ role, content });
        lastRole = role;
    }

    if (normalized.length > 0 && normalized[0].role !== 'user') normalized.shift();
    return normalized;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id || 'demo-user-id';
        let { message, history, attachments, webSearchEnabled } = await request.json();

        if (!message && (!attachments || attachments.length === 0)) {
            return new Response(JSON.stringify({ error: 'Message or attachment is required' }), { status: 400 });
        }

        // Truncate current message if too long (max 4000 chars)
        if (message && message.length > 4000) {
            message = message.substring(0, 4000) + '... [truncated]';
        }

        // 1. INTENT ENGINE (Deterministic)
        const classification = classifyIntent(message || '');
        console.log('[Novo Brain] Intent:', classification.type);

        // 2. WEB SEARCH (if enabled)
        let webSearchContext = '';
        if (webSearchEnabled && message) {
            try {
                console.log('[Novo Brain] Performing web search for:', message);
                const searchResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ai/web-search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: message, num_results: 5 })
                });

                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    if (searchData.results && searchData.results.length > 0) {
                        webSearchContext = '\n\n[WEB SEARCH RESULTS]\n' +
                            searchData.results.slice(0, 5).map((r: any, i: number) =>
                                `${i + 1}. ${r.title}\n   ${r.snippet}\n   Source: ${r.link}`
                            ).join('\n\n') +
                            '\n[END OF SEARCH RESULTS]\n\nUse the above search results to provide accurate, up-to-date information. Cite sources when appropriate.';
                    }
                }
            } catch (searchError) {
                console.error('[Novo Brain] Web search error:', searchError);
            }
        }

        // 3. MEMORY LAYER (3-Layer Context)
        const context = await buildUserContext(userId);
        const userContext = context.summary;

        // 4. COGNITIVE CORE (Model A: Llama 3.3 70B or Vision Model)
        const now = new Date();
        const timeCtx = `Current Time: ${now.toLocaleTimeString('en-US')}\nCurrent Date: ${now.toLocaleDateString('en-US')}`;
        const finalPrompt = `${COGNITIVE_CORE_PROMPT}\n\n${userContext}\n\n${timeCtx}${webSearchContext}`;

        const cleanHistory = normalizeHistory(history || []);

        // Determine if we should use a vision model
        const hasImages = attachments?.some((a: any) => a.type.startsWith('image/'));
        const model = hasImages ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';

        const messages: any[] = [
            { role: 'system', content: finalPrompt },
            ...cleanHistory.map(m => ({
                role: m.role,
                content: m.content
            }))
        ];

        // Format user message based on whether it has images
        if (hasImages) {
            const content: any[] = [];
            if (message) {
                content.push({ type: 'text', text: message });
            }
            attachments.forEach((att: any) => {
                if (att.type.startsWith('image/')) {
                    content.push({
                        type: 'image_url',
                        image_url: {
                            url: att.url // This is the base64 data URL
                        }
                    });
                }
            });
            messages.push({ role: 'user', content });
        } else {
            messages.push({ role: 'user', content: message });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'GROQ_API_KEY missing' }), { status: 500 });
        }

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.6,
                max_tokens: 4096,
                stream: true
            })
        });

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            console.error('[Novo Brain] Groq API Error:', errorText);

            let errorMessage = 'AI service is currently unavailable';
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.code === 'rate_limit_exceeded') {
                    errorMessage = 'Rate limit exceeded. Please try again in a moment or reduce the message size.';
                } else if (errorJson.error?.message) {
                    errorMessage = `Groq error: ${errorJson.error.message}`;
                }
            } catch (e) { }

            return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
        }

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
                let cognitiveCoreResponse = '';
                let insideThink = false;

                try {
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

                                    if (content.includes('<think>')) {
                                        insideThink = true;
                                        content = content.replace(/<think>/g, '');
                                    }
                                    if (content.includes('</think>')) {
                                        insideThink = false;
                                        content = content.replace(/<\/think>/g, '');
                                    }

                                    if (!insideThink) {
                                        content = content.replace(/<\/?think>/g, '');
                                        if (content) {
                                            cognitiveCoreResponse += content;
                                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                                        }
                                    }
                                } catch (e) { }
                            }
                        }
                    }

                    // 4. SYSTEM AGENT (Model B: Llama 3.1 8B)
                    const actionIntents = ['TASK', 'ROUTINE', 'PROJECT', 'SYSTEM_META'];
                    if (actionIntents.includes(classification.type)) {
                        console.log('[Novo Brain] Triggering System Agent for:', classification.type);

                        const agentResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            },
                            body: JSON.stringify({
                                model: 'llama-3.3-70b-versatile',
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
                            let agentContent = agentJson.choices?.[0]?.message?.content || '';

                            if (agentContent) {
                                // Extract JSON if the model included extra text
                                const jsonMatch = agentContent.match(/\{[\s\S]*\}/);
                                if (jsonMatch) {
                                    agentContent = jsonMatch[0];
                                }

                                // Send as a clean JSON block
                                const formattedContent = `\n\n\`\`\`json\n${agentContent.trim()}\n\`\`\``;
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: formattedContent })}\n\n`));
                            }
                        }
                    }
                } catch (error) {
                    console.error('[Novo Brain] Stream Error:', error);
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
        console.error('[Novo Brain] POST Error:', error);
        return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
    }
}
