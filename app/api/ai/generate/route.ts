import { NextRequest, NextResponse } from 'next/server';
import { groqAPI } from '@/lib/groq';
import { CONVERSATION_PROMPT, ACTION_PROMPT, KNOWLEDGE_PROMPT } from '@/lib/ai/system-prompt';
import { routeIntent, IntentType } from '@/lib/ai/router';
import { buildUserContext } from '@/lib/ai/context-builder';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { pickResultMessage } from '@/lib/ai/executor';

// =============================================================================
// MODEL CONFIGURATION  
// =============================================================================

interface ModelConfig {
  name: string;
  provider: 'groq' | 'grok' | 'chutes' | 'dashscope' | 'openrouter' | 'cerebras';
  modelId: string;
  priority: number;
}

function getAvailableModels(): ModelConfig[] {
  const models: ModelConfig[] = [];

  console.log('[AI Generate] Checking API keys:', {
    GROQ: !!process.env.GROQ_API_KEY,
    GROK: !!(process.env.GROK_API_KEY || process.env.XAI_API_KEY),
    DASHSCOPE: !!process.env.DASHSCOPE_API_KEY,
    OPENROUTER: !!process.env.OPENROUTER_API_KEY,
    CHUTES: !!process.env.CHUTES_API_TOKEN,
  });

  // Groq - PRIMARY MODEL. Was qwen/qwen3-32b, then llama-3.3-70b-versatile
  // (both decommissioned from this Groq account as of 2026-08-17 — GET
  // /v1/models now only lists the gpt-oss family + qwen3.6). openai/gpt-oss-120b
  // is the strongest surviving model on this account and was verified live.
  if (process.env.GROQ_API_KEY) {
    models.push({ name: 'gpt-oss-120b', provider: 'groq', modelId: 'openai/gpt-oss-120b', priority: 1 });
  }

  // Grok (xAI) — disabled 2026-07-16: xAI team account is out of credits
  // (api.x.ai returns "permission-denied ... reached its monthly spending
  // limit") and grok-2-1212 is no longer a valid model id on top of that.
  // Re-enable once the xAI account is funded and the model id is confirmed
  // current (check https://api.x.ai/v1/models with a live key).
  if (false && (process.env.GROK_API_KEY || process.env.XAI_API_KEY)) {
    const { grokAPI } = require('@/lib/grok');
    models.push({ name: 'grok-2', provider: 'grok', modelId: 'grok-2-1212', priority: 2 });
  }

  // Cerebras — added 2026-07-17 to take over Grok's old priority-2 slot.
  // Independent quota pool from Groq, OpenAI-compatible, fast inference.
  // Verified live against GET /v1/models 2026-07-17 — this account's
  // available models are gemma-4-31b, zai-glm-4.7, gpt-oss-120b only.
  if (process.env.CEREBRAS_API_KEY) {
    models.push({ name: 'cerebras-gpt-oss-120b', provider: 'cerebras', modelId: 'gpt-oss-120b', priority: 2 });
  }

  // DashScope — disabled 2026-07-16: DASHSCOPE_API_KEY returns 401 "Invalid
  // API-key provided". Needs a fresh key from the Alibaba Cloud console
  // before this can be re-enabled.
  if (false && process.env.DASHSCOPE_API_KEY) {
    models.push({ name: 'qwen-max', provider: 'dashscope', modelId: 'qwen-max', priority: 3 });
  }

  // OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    models.push({ name: 'gpt-oss-20b', provider: 'openrouter', modelId: 'openai/gpt-oss-20b:free', priority: 4 });
  }

  // Chutes
  if (process.env.CHUTES_API_TOKEN) {
    models.push({ name: 'gemma-3-4b', provider: 'chutes', modelId: 'unsloth/gemma-3-4b-it', priority: 5 });
  }

  return models.sort((a, b) => a.priority - b.priority);
}

function normalizeHistory(history: any[]): any[] {
  if (!history || history.length === 0) return [];

  const normalized: any[] = [];
  let lastRole = '';

  for (const msg of history) {
    const role = msg.role === 'user' ? 'user' : 'assistant';
    if (role === lastRole) continue;
    normalized.push({ role, content: msg.content || '' });
    lastRole = role;
  }

  if (normalized.length > 0 && normalized[0].role !== 'user') {
    normalized.shift();
  }

  return normalized;
}

// =============================================================================
// FALLBACK STRATEGY
// =============================================================================

async function callModelWithFallback(
  message: string,
  history: any[],
  systemPrompt: string,
  requestedModel?: string
): Promise<{ content: string; model: string }> {

  let availableModels = getAvailableModels();

  if (requestedModel && requestedModel !== 'auto') {
    const matched = availableModels.find(m => m.name === requestedModel || m.modelId === requestedModel);
    if (matched) {
      availableModels = [matched, ...availableModels.filter(m => m.modelId !== matched.modelId)];
    }
  }

  if (availableModels.length === 0) {
    throw new Error('No AI models configured. Add GROQ_API_KEY to environment.');
  }

  console.log(`[AI Generate] Available: ${availableModels.map(m => m.name).join(', ')}`);

  const cleanHistory = normalizeHistory(history);
  let lastError: Error | null = null;

  for (const model of availableModels) {
    try {
      console.log(`[AI Generate] Trying: ${model.name}`);
      const result = await callModel(model, message, cleanHistory, systemPrompt);

      if (result.content?.trim()) {
        console.log(`[AI Generate] Success: ${model.name}`);
        return { content: result.content, model: model.name };
      }
    } catch (error) {
      console.error(`[AI Generate] Error with ${model.name}:`, error);
      lastError = error as Error;
    }
  }

  throw lastError || new Error('All AI models failed');
}

async function callModel(
  config: ModelConfig,
  message: string,
  history: any[],
  systemPrompt: string
): Promise<{ content: string }> {

  switch (config.provider) {
    case 'groq':
      return await groqAPI.generateResponse(message, '', history, systemPrompt, config.modelId);

    case 'grok': {
      const { grokAPI } = await import('@/lib/grok');
      return await grokAPI.generateResponse(message, '', history, systemPrompt, []);
    }

    case 'dashscope': {
      const { dashscopeAPI } = await import('@/lib/dashscope');
      return await dashscopeAPI.generateResponse(message, '', history, systemPrompt, config.modelId);
    }

    case 'openrouter': {
      const { openRouterAPI } = await import('@/lib/openrouter');
      return await openRouterAPI.generateResponse(message, '', history, systemPrompt, config.modelId);
    }

    case 'chutes': {
      const { chutesAPI } = await import('@/lib/chutes');
      return await chutesAPI.generateResponse(message, '', history, systemPrompt, config.modelId);
    }

    case 'cerebras': {
      const { cerebrasAPI } = await import('@/lib/cerebras');
      return await cerebrasAPI.generateResponse(message, '', history, systemPrompt, config.modelId);
    }

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// =============================================================================
// RESPONSE POST-PROCESSOR
// =============================================================================

function normalizeResponse(content: string): string {
  let normalized = content;
  const fillers = [
    /^(Great question!|Good question!)\s*/gi,
    /^(I'd be happy to help!)\s*/gi,
    /^(Sure!|Of course!|Absolutely!)\s*/gi,
  ];
  for (const p of fillers) normalized = normalized.replace(p, '');
  return normalized.replace(/!{2,}/g, '!').trim();
}

// =============================================================================
// MAIN HANDLER & ANTI-HALLUCINATION GUARDRAILS
// =============================================================================

import { prisma } from '@/lib/prisma';

async function validateAndSanitizeAction(action: any, userId: string): Promise<any> {
  if (!action || !action.type) return action;
  
  const type = String(action.type).toUpperCase();
  const payload = action.payload || {};

  console.log(`[Anti-Hallucination] Validating action ${type} for user ${userId}`);

  // 1. Validate TASK mutations (UPDATE/DELETE)
  if (type === 'UPDATE_TASK' || type === 'DELETE_TASK') {
    if (!payload.id) {
      console.warn(`[Anti-Hallucination] Task action lacks ID, attempting fallback match by title: ${payload.title}`);
      if (payload.title) {
        const found = await prisma.task.findFirst({
          where: { userId, title: { contains: payload.title } }
        });
        if (found) {
          payload.id = found.id;
          console.log(`[Anti-Hallucination] Matched task ID: ${found.id}`);
        }
      }
    } else {
      const exists = await prisma.task.findFirst({
        where: { id: payload.id, userId }
      });
      if (!exists) {
        console.warn(`[Anti-Hallucination] Task ID ${payload.id} does not exist. Trying title match.`);
        if (payload.title) {
          const found = await prisma.task.findFirst({
            where: { userId, title: { contains: payload.title } }
          });
          if (found) {
            payload.id = found.id;
          } else {
            // Convert update to create to prevent crash and preserve user request
            if (type === 'UPDATE_TASK') {
              console.log(`[Anti-Hallucination] Task not found. Converting UPDATE to CREATE.`);
              action.type = 'CREATE_TASK';
            } else {
              action.type = 'SYSTEM_QUERY'; // Neutral safe action
            }
          }
        } else {
          action.type = 'SYSTEM_QUERY';
        }
      }
    }
  }

  // 2. Validate ROUTINE mutations
  if (type === 'UPDATE_ROUTINE' || type === 'DELETE_ROUTINE') {
    if (payload.id) {
      const exists = await prisma.routine.findFirst({
        where: { id: payload.id, userId }
      });
      if (!exists) {
        console.warn(`[Anti-Hallucination] Routine ID ${payload.id} does not exist.`);
        if (payload.name) {
          const found = await prisma.routine.findFirst({
            where: { userId, name: { contains: payload.name } }
          });
          if (found) {
            payload.id = found.id;
          } else {
            action.type = 'SYSTEM_QUERY';
          }
        } else {
          action.type = 'SYSTEM_QUERY';
        }
      }
    }
  }

  // 3. Validate Cognitive State Updates
  if (type === 'UPDATE_COGNITIVE_STATE') {
    // Standardize fatigue levels
    if (payload.fatigueEstimate) {
      const normalized = String(payload.fatigueEstimate).toLowerCase();
      if (normalized.includes('crit') || normalized.includes('alarm')) {
        payload.fatigueEstimate = 'critical';
      } else if (normalized.includes('hi') || normalized.includes('alt')) {
        payload.fatigueEstimate = 'high';
      } else if (normalized.includes('med') || normalized.includes('mod')) {
        payload.fatigueEstimate = 'medium';
      } else {
        payload.fatigueEstimate = 'low';
      }
    }

    // Keep productivityScore bounded
    if (payload.productivityScore !== undefined) {
      let score = Number(payload.productivityScore);
      if (isNaN(score)) score = 8.0;
      if (score < 0) score = 0;
      if (score > 100) score = 100;
      payload.productivityScore = score;
    }

    // Keep focusTimeToday bounded
    if (payload.focusTimeToday !== undefined) {
      let focus = Number(payload.focusTimeToday);
      if (isNaN(focus) || focus < 0) focus = 0;
      payload.focusTimeToday = focus;
    }
  }

  // 4. Validate Pipeline sub-actions recursively
  if (type === 'COGNITIVE_PIPELINE' && Array.isArray(payload.actions)) {
    for (let i = 0; i < payload.actions.length; i++) {
      payload.actions[i] = await validateAndSanitizeAction(payload.actions[i], userId);
    }
  }

  action.payload = payload;
  return action;
}

export async function POST(request: NextRequest) {
  console.log('[AI API] Incoming POST request to /api/ai/generate');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const body = await request.json();
    console.log('[AI API] Authenticated generation request received.');
    const { message, history, webSearchEnabled, model: requestedModel } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Classify Intent using the deterministic router
    const classification = await routeIntent(message);
    console.log('[AI] Intent classified:', classification.type);

    // =========================================================================
    // GENERATE_FILE SHORT-CIRCUIT: Skip AI model, auto-execute, return SSE
    // =========================================================================
    if (classification.type === 'GENERATE_FILE') {
      console.log('[AI] GENERATE_FILE short-circuit: bypassing model, auto-executing');

      // Extract context from conversation history
      const lastAssistantMsg = (history || [])
        .filter((m: any) => m.role === 'assistant')
        .pop();
      const previousContent = lastAssistantMsg?.content || '';

      // Check if there's HTML in previous messages
      const htmlInHistory = previousContent.match(/```html\s*([\s\S]*?)```/);
      const existingContent = htmlInHistory ? htmlInHistory[1].trim() : '';

      const description = existingContent
        ? `Genera un documento basado en este contenido previo: ${previousContent.slice(0, 500)}`
        : message;

      // Only short-circuit if we actually have content to work with, otherwise let the model generate it
      if (!existingContent && classification.confidence < 1.0) {
        console.log('[AI] GENERATE_FILE short-circuit skipped: no existing content found for "create from previous" request');
      } else if (existingContent || classification.confidence >= 0.9) {
        const autoAction = {
          type: 'GENERATE_FILE' as const,
          payload: {
            filename: existingContent ? 'documento.html' : 'nuevo_documento.html',
            content: existingContent,
            mimeType: 'text/html' as const,
            description: description.slice(0, 500),
          }
        };

        try {
          const { executeAIAction, pickDisplayableFields } = await import('@/lib/ai/executor');
          const execResult = await executeAIAction(autoAction, userId);

          // Build a structured JSON that context.tsx can parse from the SSE stream
          const resultJson = {
            analysis: 'Procesando solicitud de generación de archivo mediante acceso interno al sistema.',
            plan: execResult.metadata?.steps || [
              { id: '1', label: 'Iniciando proceso de generación', status: 'completed' },
              { id: '2', label: 'Ejecutando generador de Novo', status: 'completed' }
            ],
            action: {
              type: 'GENERATE_FILE',
              payload: autoAction.payload,
              _executed: true,
              _result: {
                success: execResult.success,
                message: execResult.message,
                metadata: { ...(execResult.metadata || {}), ...pickDisplayableFields(execResult.data) }
              }
            },
            message: execResult.success
              ? `${execResult.message || 'He generado tu archivo.'}`
              : `Hubo un error al generar el archivo: ${execResult.error || 'Error desconocido'}`
          };

          // Return as SSE stream so context.tsx can read it
          const encoder = new TextEncoder();
          const jsonStr = JSON.stringify(resultJson);
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: jsonStr })}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          });

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            }
          });
        } catch {
          console.error('[AI] GENERATE_FILE short-circuit failed.');
        }
      }
    }

    // Build Context
    let userContextStr = '';
    try {
      const context = await buildUserContext(userId);
      userContextStr = context.summary;
    } catch { console.error('[AI] Context retrieval failed.'); }

    // Select Prompt based on intent (unified 3-layer system)
    let selectedPrompt: string;
    let expectStructured = false;

    switch (classification.type) {
      case 'KNOWLEDGE_RAG':
        selectedPrompt = KNOWLEDGE_PROMPT;
        break;
      case 'UI_COMMAND':
      case 'SIMPLE_TASK':
      case 'DOCUMENT_CREATION':
      case 'SCHEDULE_ACTION':
      case 'GENERATE_FILE':
      case 'COMPLEX_PLANNING':
      case 'COGNITIVE_AUTOMATION':
        selectedPrompt = ACTION_PROMPT;
        expectStructured = true;
        break;
      case 'CONVERSATION':
      default:
        selectedPrompt = CONVERSATION_PROMPT;
        expectStructured = false;
    }

    // Enhance with web search (only for Knowledge or Conversation where relevant, simple heuristic)
    let enhancedMessage = message;
    if (webSearchEnabled && (classification.type === 'KNOWLEDGE_RAG' || classification.type === 'CONVERSATION')) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/ai/web-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: message.slice(0, 200), num_results: 5 })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.results?.length) {
            enhancedMessage += '\n\n--- Web Results ---\n';
            data.results.forEach((r: any, i: number) => {
              enhancedMessage += `${i + 1}. ${r.title}: ${r.snippet}\n`;
            });
          }
        }
      } catch { console.error('[AI] Web search failed.'); }
    }

    // Build final prompt
    const now = new Date();
    const timeCtx = `Time: ${now.toLocaleTimeString('en-US')}\nDate: ${now.toLocaleDateString('en-US')}`;
    const finalPrompt = `${selectedPrompt}\n\nCOGNITIVE CONTEXT (JSON):\n${userContextStr}\n\nCurrent Time Info:\n${timeCtx}`;

    // Call AI
    const result = await callModelWithFallback(enhancedMessage, history || [], finalPrompt, requestedModel);
    let content = normalizeResponse(result.content);

    // Return based on intent
    if (classification.type === 'CONVERSATION' || classification.type === 'KNOWLEDGE_RAG') {
      return NextResponse.json({
        content,
        metadata: { intentType: classification.type, model: result.model }
      });
    }

    // Attempt to parse JSON for structured intents
    let parsed;
    try {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) parsed = JSON.parse(match[1].trim());
      else {
        const i = content.indexOf('{'), j = content.lastIndexOf('}');
        if (i !== -1 && j > i) parsed = JSON.parse(content.substring(i, j + 1));
      }
    } catch {
      console.error('[AI] Structured output parsing failed.');
    }

    if (classification.type === 'COMPLEX_PLANNING' && parsed && parsed.phases) {
      return NextResponse.json({
        content: `Here is a proposed plan for "${parsed.project_title}". Please review and approve it.`,
        blocks: [
          { id: crypto.randomUUID(), type: 'plan_preview', content: parsed, status: 'waiting' }
        ],
        metadata: { intentType: classification.type, model: result.model }
      });
    }

    if (parsed) {
      // 1. Run the Anti-Hallucination & Anti-Deception validation middleware!
      if (parsed.action) {
        parsed.action = await validateAndSanitizeAction(parsed.action, userId);
      }

      const actionType = (parsed.action?.type || '').toUpperCase();

      // Only file generation is safe to execute from a model response. A
      // cognitive inference can create tasks, change persisted state or imply
      // health facts, so it must remain a visible user-confirmed proposal.
      if (actionType === 'GENERATE_FILE') {
        try {
          const { executeAIAction, pickDisplayableFields } = await import('@/lib/ai/executor');
          const execResult = await executeAIAction(parsed.action, userId);
          return NextResponse.json({
            content: pickResultMessage(execResult, parsed.message, 'He realizado los cambios en tu estado cognitivo.'),
            blocks: [
              parsed.analysis ? { id: crypto.randomUUID(), type: 'analysis', content: parsed.analysis, isVisible: true } : null,
              {
                id: crypto.randomUUID(),
                type: 'result',
                content: execResult.message || 'Calibración cognitiva realizada con éxito.',
                status: execResult.success ? 'success' : 'failed',
                metadata: { ...(execResult.metadata || {}), ...pickDisplayableFields(execResult.data) }
              },
            ].filter(Boolean),
            metadata: { intentType: classification.type, model: result.model }
          });
        } catch {
          console.error('[AI] Automatic file generation failed.');
        }
      }

      // All other actions: show confirmation
      return NextResponse.json({
        content: parsed.message || '',
        blocks: [
          parsed.analysis ? { id: crypto.randomUUID(), type: 'analysis', content: parsed.analysis, isVisible: true } : null,
          parsed.plan?.length ? { id: crypto.randomUUID(), type: 'plan', content: parsed.plan.map((p: any, i: number) => ({ id: String(i), label: p.label, status: p.status })) } : null,
          parsed.action ? { id: crypto.randomUUID(), type: 'confirmation', content: parsed.action, status: 'waiting', actionId: crypto.randomUUID() } : null,
        ].filter(Boolean),
        metadata: { intentType: classification.type, model: result.model }
      });
    }

    // Fallback: if GENERATE_FILE intent but AI returned text instead of JSON, auto-execute
    if (classification.type === 'GENERATE_FILE' && !parsed) {
      const htmlMatch = content.match(/```(?:html)?\s*([\s\S]*?)```/i);
      const fileContent = htmlMatch ? htmlMatch[1].trim() : (content.includes('<html>') ? content.trim() : '');
      const description = message.slice(0, 200);

      const autoAction = {
        type: 'GENERATE_FILE' as const,
        payload: {
          filename: 'documento.html',
          content: fileContent,
          mimeType: 'text/html',
          description: description,
        }
      };

      try {
        const { executeAIAction, pickDisplayableFields } = await import('@/lib/ai/executor');
        const execResult = await executeAIAction(autoAction, userId);
        return NextResponse.json({
          content: execResult.message || 'Archivo generado.',
          blocks: [
            {
              id: crypto.randomUUID(),
              type: 'result',
              content: execResult.message || 'Archivo listo.',
              status: execResult.success ? 'success' : 'failed',
              metadata: { ...(execResult.metadata || {}), ...pickDisplayableFields(execResult.data) }
            },
          ],
          metadata: { intentType: classification.type, model: result.model }
        });
      } catch {
        console.error('[AI] Auto-execute GENERATE_FILE fallback failed.');
        return NextResponse.json({
          content: 'Generando archivo...',
          blocks: [
            { id: crypto.randomUUID(), type: 'confirmation', content: autoAction, status: 'waiting', actionId: crypto.randomUUID() },
          ],
          metadata: { intentType: classification.type, model: result.model }
        });
      }
    }

    return NextResponse.json({
      content,
      metadata: { intentType: classification.type, model: result.model }
    });

  } catch {
    console.error('[AI] Request failed.');
    return NextResponse.json(
      { error: 'InternalError', message: 'No se pudo completar la solicitud de IA.' },
      { status: 500 }
    );
  }
}
