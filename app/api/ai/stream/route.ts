import { NextRequest } from 'next/server';
import { groqAPI } from '@/lib/groq';
import {
    SYSTEM_PROMPT, COGNITIVE_CORE_PROMPT, SYSTEM_AGENT_PROMPT, HYBRID_PROMPT,
    CODE_SPECIALIST_PROMPT, QUIZ_SPECIALIST_PROMPT, DESIGN_SPECIALIST_PROMPT,
    VISION_ANALYSIS_PROMPT, REPLICATION_CODE_PROMPT
} from '@/lib/ai/system-prompt';
import { classifyIntent, requiresSystemContext } from '@/lib/ai/classifier';
import type { IntentType } from '@/lib/ai/classifier';
import { buildUserContext } from '@/lib/ai/context-builder';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Normalize history and prevent token limit issues
function normalizeHistory(history: any[]): any[] {
    if (!history?.length) return [];

    // Limit to last 20 messages to keep context window robust yet manageable
    const recentHistory = history.slice(-20);
    const normalized: any[] = [];
    let lastRole = '';

    for (const msg of recentHistory) {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        if (role === lastRole) continue;

        // Smart middle truncation for extremely long messages (max 6000 chars per history message)
        let content = msg.content || '';
        if (content.length > 6000) {
            const keepStart = 3000;
            const keepEnd = 2800;
            content = content.substring(0, keepStart) + '\n[...]\n' + content.substring(content.length - keepEnd);
        }

        normalized.push({ role, content });
        lastRole = role;
    }

    if (normalized.length > 0 && normalized[0].role !== 'user') normalized.shift();
    return normalized;
}

// Model Orchestra — Route to the best model for each task type
function selectModelForIntent(
    intentType: IntentType,
    hasImages: boolean,
    userMessage: string = ''
): { model: string; prompt: string; label: string; isReplication?: boolean } {
    // Check if the user wants to replicate/clone a design from an image
    const replicationKeywords = ['replica', 'replicar', 'clonar', 'clone', 'copiar', 'copy', 'igual', 'identic',
        'hazme esta', 'hazme esa', 'como esta', 'como esa', 'recrea', 'recrear', 'reproduce',
        'pagina', 'web', 'landing', 'diseño', 'design', 'sitio', 'site', 'codigo', 'code',
        'html', 'css', 'programa', 'construye', 'build', 'haz'];
    const lowerMsg = userMessage.toLowerCase();
    const wantsReplication = replicationKeywords.some(kw => lowerMsg.includes(kw));

    // TWO-MODEL REPLICATION PIPELINE (flagged for special handling)
    if (hasImages && (wantsReplication || ['CODE', 'DESIGN'].includes(intentType))) {
        return {
            model: 'qwen/qwen3-32b',              // Code gen model (Step 2)
            prompt: REPLICATION_CODE_PROMPT,
            label: '🔬 Design Replicator',
            isReplication: true                         // Flag for two-model pipeline
        };
    }

    // Vision without code intent — general image analysis
    if (hasImages) {
        return {
            model: 'llama-3.2-11b-vision-preview',
            prompt: COGNITIVE_CORE_PROMPT,
            label: '👁️ Vision'
        };
    }

    switch (intentType) {
        case 'CODE':
            return {
                model: 'qwen/qwen3-32b',
                prompt: CODE_SPECIALIST_PROMPT,
                label: '🧠 Code Engine'
            };
        case 'QUIZ':
            return {
                model: 'qwen/qwen3-32b',
                prompt: QUIZ_SPECIALIST_PROMPT,
                label: '🎯 Quiz Engine'
            };
        case 'DESIGN':
            return {
                model: 'qwen/qwen3-32b',
                prompt: DESIGN_SPECIALIST_PROMPT,
                label: '🎨 Design Engine'
            };
        default:
            return {
                model: 'llama-3.3-70b-versatile',
                prompt: COGNITIVE_CORE_PROMPT,
                label: '💬 Cognitive Core'
            };
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id || 'demo-user-id';

        // Twin Mode is Pro-only — re-verify server-side on every request,
        // never trust the client's requested value directly.
        let twinMode = false;

        let { message, history, attachments, webSearchEnabled, model: requestedModel, twinMode: requestedTwinMode } = await request.json();

        if (requestedTwinMode) {
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
            twinMode = user?.plan === 'pro';
        }

        // Sanitize requestedModel to prevent obsolete model names causing Groq errors.
        // qwen-2.5-coder-32b was decommissioned by Groq; qwen/qwen3-32b is the current
        // replacement (already used successfully elsewhere in this codebase).
        if (requestedModel) {
            if (requestedModel === 'qwen-2.5-coder-32b' || requestedModel === 'qwen3-32b' || requestedModel === 'openai/gpt-oss-120b') {
                requestedModel = 'qwen/qwen3-32b';
            } else if (requestedModel === 'meta-llama/llama-4-scout-17b-16e-instruct') {
                requestedModel = 'llama-3.2-11b-vision-preview';
            }
        }

        if (!message && (!attachments || attachments.length === 0)) {
            return new Response(JSON.stringify({ error: 'Message or attachment is required' }), { status: 400 });
        }

        // Smart middle-truncation for current message if too long (max 8000 chars)
        if (message && message.length > 8000) {
            const keepStart = 4000;
            const keepEnd = 3800;
            message = message.substring(0, keepStart) + '\n[...]\n' + message.substring(message.length - keepEnd);
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
        const context = await buildUserContext(userId, { twinMode });
        const userContext = context.summary;

        // 4. MODEL ORCHESTRA — Route to the best model for the task
        const now = new Date();
        const timeCtx = `Current Time: ${now.toLocaleTimeString('en-US')}\nCurrent Date: ${now.toLocaleDateString('en-US')}`;

        // Select model + prompt based on intent type (auto-routing baseline)
        const hasImages = attachments?.some((a: any) => a.type.startsWith('image/'));
        let { model, prompt: selectedPrompt, label: modelLabel, isReplication } = selectModelForIntent(
            classification.type,
            hasImages,
            message || ''
        );

        // USER MODEL OVERRIDE — always respect explicit user selection
        if (requestedModel && requestedModel !== 'auto') {
            model = requestedModel;

            // Update prompt to match the explicitly chosen model
            if (model.includes('qwen') || model.includes('coder-32b')) {
                modelLabel = '⚡ Qwen 2.5 Coder';
                selectedPrompt = SYSTEM_PROMPT; // General-purpose prompt for Qwen
            } else if (model.includes('gpt-oss')) {
                modelLabel = '🧠 Code Engine (Qwen 32B)';
                selectedPrompt = CODE_SPECIALIST_PROMPT;
            } else if (model.includes('llama-3.3')) {
                modelLabel = '💬 Cognitive Core (Llama 3.3)';
                selectedPrompt = COGNITIVE_CORE_PROMPT;
            } else if (model.includes('llama-4-scout') || model.includes('llama-3.2') || model.includes('vision')) {
                modelLabel = '👁️ Vision Scout (Llama 3.2)';
                selectedPrompt = COGNITIVE_CORE_PROMPT;
            } else {
                modelLabel = model.split('/').pop() || model;
                selectedPrompt = SYSTEM_PROMPT;
            }

            // Only allow replication pipeline if user explicitly picks a code/vision model
            if (isReplication && !model.includes('gpt-oss') && !model.includes('coder-32b') && !model.includes('llama-4-scout') && !model.includes('llama-3.2')) {
                isReplication = false;
            }
        }
        console.log(`[Novo Brain] Routing to: ${model} (${modelLabel})${isReplication ? ' [TWO-MODEL PIPELINE]' : ''}`);

        // =====================================================================
        // TWO-MODEL REPLICATION PIPELINE
        // Step 1: Llama 3.2 Vision analyzes the image visually (non-streaming)
        // Step 2: Qwen 2.5 Coder generates code from the analysis (streaming)
        // =====================================================================
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), { status: 503 });
        }

        let visualAnalysis = '';
        if (isReplication && hasImages) {
            console.log('[Novo Brain] Step 1: Visual analysis with Llama 3.2 Vision...');

            // Build the vision request with image attachments
            const visionContent: any[] = [
                { type: 'text', text: 'Analyze this screenshot in extreme detail following the format I specified. Be precise with colors and layout.' }
            ];
            attachments.forEach((att: any) => {
                if (att.type.startsWith('image/')) {
                    visionContent.push({
                        type: 'image_url',
                        image_url: { url: att.url }
                    });
                }
            });

            try {
                const visionResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3.2-11b-vision-preview',
                        messages: [
                            { role: 'system', content: VISION_ANALYSIS_PROMPT },
                            { role: 'user', content: visionContent }
                        ],
                        temperature: 0.3,
                        max_tokens: 4096,
                        stream: false
                    })
                });

                if (visionResponse.ok) {
                    const visionData = await visionResponse.json();
                    visualAnalysis = visionData.choices?.[0]?.message?.content || '';
                    console.log(`[Novo Brain] Visual analysis complete (${visualAnalysis.length} chars)`);
                } else {
                    console.error('[Novo Brain] Vision analysis failed:', await visionResponse.text());
                }
            } catch (err) {
                console.error('[Novo Brain] Vision analysis error:', err);
            }
        }

        const activeSignalContext = context.structured.activeSignal
            ? `\n\nSEÑAL ACTIVA HOY: ${context.structured.activeSignal.description}\nMenciónala solo si es relevante para lo que el usuario te está preguntando ahora mismo — no la saques a colación si no viene al caso en esta conversación.`
            : '';

        const twinContextStr = context.structured.twinContext
            ? `\n\nPERFIL COMPLETO DEL TWIN (Modo Twin activo):\n${JSON.stringify(context.structured.twinContext, null, 2)}`
            : '';

        const finalPrompt = `${selectedPrompt}\n\n${userContext}\n\n${timeCtx}${webSearchContext}${activeSignalContext}${twinContextStr}`;

        const cleanHistory = normalizeHistory(history || []);

        const messages: any[] = [
            { role: 'system', content: finalPrompt },
            ...cleanHistory.map(m => ({
                role: m.role,
                content: m.content
            }))
        ];

        // Format user message based on whether it has images
        if (isReplication && visualAnalysis) {
            // TWO-MODEL PIPELINE: Send the visual analysis as text to GPT-OSS (no images needed)
            const replicationMessage = `The user wants to replicate a website from a screenshot. Here is the detailed visual analysis of the image:\n\n${visualAnalysis}\n\nUser's request: "${message || 'Replicate this design'}"

Generate the complete HTML/CSS code that matches this visual specification exactly.`;
            messages.push({ role: 'user', content: replicationMessage });
        } else if (hasImages) {
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

        let finalModel = model;
        let isFallbackUsed = false;
        let originalErrorMsg = '';

        let groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: finalModel,
                messages,
                temperature: ['CODE', 'QUIZ', 'DESIGN'].includes(classification.type) ? 0.2 : 0.6,
                max_tokens: ['CODE', 'QUIZ', 'DESIGN'].includes(classification.type) ? 16384 : 4096,
                stream: true
            })
        });

        if (!groqResponse.ok && finalModel !== 'llama-3.3-70b-versatile') {
            originalErrorMsg = await groqResponse.text();
            console.warn(`[Novo Brain] Primary model ${finalModel} failed: ${originalErrorMsg}. Retrying with Llama 3.3 70B fallback...`);

            finalModel = 'llama-3.3-70b-versatile';
            isFallbackUsed = true;
            
            groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: finalModel,
                    messages,
                    temperature: 0.6,
                    max_tokens: 4096,
                    stream: true
                })
            });
        }

        // Final Ultimate Fallback to Llama 3.1 8B (highly stable, very high rate limit) if Qwen Coder also fails
        if (!groqResponse.ok && finalModel !== 'llama-3.1-8b-instant') {
            console.warn(`[Novo Brain] Fallback model ${finalModel} also failed. Triggering Ultimate stable fallback Llama 3.1 8B...`);
            finalModel = 'llama-3.1-8b-instant';
            isFallbackUsed = true;
            groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: finalModel,
                    messages,
                    temperature: 0.6,
                    max_tokens: 4096,
                    stream: true
                })
            });
        }

        // Gemini Direct Rescue: Groq's free tier shares one account-level daily
        // quota across ALL its models, so once it's exhausted every Groq fallback
        // above fails together. Gemini (Google AI) is a fully independent quota
        // pool with a far more generous free tier (15 RPM / 1500 RPD), reached
        // here via Google's OpenAI-compatible endpoint so the exact same SSE
        // streaming path below works unchanged.
        if (!groqResponse.ok) {
            const geminiKey = process.env.GEMINI_API_KEY;
            if (geminiKey) {
                console.warn('[Novo Brain] Groq exhausted. Activating Gemini direct rescue...');
                finalModel = 'gemini-2.0-flash';
                isFallbackUsed = true;
                modelLabel = '✨ Gemini (Rescate)';

                groqResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${geminiKey}`
                    },
                    body: JSON.stringify({
                        model: finalModel,
                        messages,
                        temperature: 0.6,
                        stream: true
                    })
                });
            }
        }

        // OpenRouter Rescue Fallback: If all Groq attempts are throttled/failed,
        // activate a cheap, always-available OpenRouter model as a last-resort
        // fail-safe. Deliberately NOT a ":free" tier slug — OpenRouter rotates
        // and deprecates those free model IDs frequently (this exact tier broke
        // in production when "google/gemini-2.0-flash-lite:free" was retired),
        // so the last-resort tier needs a stable paid model instead.
        if (!groqResponse.ok) {
            const openRouterKey = process.env.OPENROUTER_API_KEY;
            if (openRouterKey) {
                console.warn('[Novo Brain] Groq completely throttled/failed. Activating OpenRouter rescue fallback...');
                finalModel = 'openai/gpt-4o-mini';
                isFallbackUsed = true;
                modelLabel = '⚡ GPT-4o mini (Rescate)';
                
                groqResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openRouterKey}`,
                        'HTTP-Referer': 'https://productivitynovo.vercel.app',
                        'X-Title': 'Novo AI'
                    },
                    body: JSON.stringify({
                        model: finalModel,
                        messages,
                        temperature: 0.6,
                        stream: true
                    })
                });
            }
        }

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            console.error('[Novo Brain] Groq API Error:', errorText);

            let errorMessage = 'AI service is currently unavailable';
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.code === 'rate_limit_exceeded') {
                    errorMessage = 'Rate limit exceeded. Please try again in 30-60 seconds or simplify your message.';
                } else if (errorJson.error?.message) {
                    errorMessage = `Groq error: ${errorJson.error.message}`;
                }
            } catch (e) { }

            // Return 200 but send the error in the stream so the UI can display it
            return new Response(new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: `⚠️ ${errorMessage}` })}\n\n`));
                    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                    controller.close();
                }
            }), {
                headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
            });
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

                // Emit model metadata as first SSE event
                const currentLabel = modelLabel || (isFallbackUsed ? (finalModel === 'llama-3.1-8b-instant' ? '⚠️ Llama 3.1 8B (Respaldo Estable)' : '⚠️ Llama 3.3 70B (Respaldo)') : modelLabel);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ meta: { model: finalModel, label: currentLabel, intent: classification.type, fallback: isFallbackUsed } })}\n\n`));

                if (isFallbackUsed) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `*⚠️ Nota: El modelo principal (${model}) superó el límite de velocidad o no está disponible. Se activó el respaldo a ${currentLabel}.*\n\n` })}\n\n`));
                }

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

                    // 4. SYSTEM AGENT (Model B) - Wrapped in try/catch to maintain stream health
                    const actionIntents = ['TASK', 'ROUTINE', 'PROJECT', 'SYSTEM_META', 'COGNITIVE'];
                    if (actionIntents.includes(classification.type)) {
                        try {
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
                                    const jsonMatch = agentContent.match(/\{[\s\S]*\}/);
                                    if (jsonMatch) {
                                        agentContent = jsonMatch[0];
                                    }
                                    const formattedContent = `\n\n\`\`\`json\n${agentContent.trim()}\n\`\`\``;
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: formattedContent })}\n\n`));
                                }
                            } else {
                                console.warn('[Novo Brain] System Agent failed but stream preserved.');
                            }
                        } catch (agentErr) {
                            console.error('[Novo Brain] System Agent fetch error:', agentErr);
                        }
                    }
                } catch (error) {
                    console.error('[Novo Brain] Stream Error:', error);
                    // Mirror the !groqResponse.ok branch above (line ~410) — without
                    // this, a read error here (Groq connection drop, timeout, etc.)
                    // closed the stream with meta already sent but zero content
                    // chunks ever enqueued: the client saw a fully "successful"
                    // empty stream and rendered nothing, with no error surfaced.
                    const partial = cognitiveCoreResponse ? '\n\n' : '';
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `${partial}⚠️ La respuesta se interrumpió inesperadamente. Intenta de nuevo.` })}\n\n`));
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
        return new Response(JSON.stringify({ error: 'El asistente no está disponible en este momento' }), { status: 500 });
    }
}
