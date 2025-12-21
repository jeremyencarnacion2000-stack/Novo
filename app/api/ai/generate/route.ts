import { NextRequest, NextResponse } from 'next/server';
import { groqAPI } from '@/lib/groq';
import { SYSTEM_PROMPT, COGNITIVE_CORE_PROMPT, SYSTEM_AGENT_PROMPT, HYBRID_PROMPT } from '@/lib/ai/system-prompt';
import { classifyIntent, requiresSystemContext } from '@/lib/ai/classifier';
import { buildUserContext } from '@/lib/ai/context-builder';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// =============================================================================
// MODEL CONFIGURATION  
// =============================================================================

interface ModelConfig {
  name: string;
  provider: 'groq' | 'grok' | 'chutes' | 'dashscope' | 'openrouter';
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

  // Groq - NEW PRIMARY MODEL
  if (process.env.GROQ_API_KEY) {
    models.push({ name: 'qwen3-32b', provider: 'groq', modelId: 'qwen/qwen3-32b', priority: 1 });
  }

  // Grok (xAI)
  if (process.env.GROK_API_KEY || process.env.XAI_API_KEY) {
    const { grokAPI } = require('@/lib/grok');
    models.push({ name: 'grok-2', provider: 'grok', modelId: 'grok-2-1212', priority: 2 });
  }

  // DashScope
  if (process.env.DASHSCOPE_API_KEY) {
    models.push({ name: 'qwen-max', provider: 'dashscope', modelId: 'qwen-max', priority: 3 });
  }

  // OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    models.push({ name: 'qwen3-235b', provider: 'openrouter', modelId: 'qwen/qwen3-235b-a22b:free', priority: 4 });
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
  systemPrompt: string
): Promise<{ content: string; model: string }> {

  const availableModels = getAvailableModels();

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
// MAIN HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'demo-user-id';
    const { message, history, webSearchEnabled } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Classify Intent
    const classification = classifyIntent(message);
    console.log('[AI] Intent:', classification.type);

    // Build Context
    let userContext = '';
    if (requiresSystemContext(classification)) {
      try {
        const context = await buildUserContext(userId);
        userContext = context.summary;
      } catch (e) { console.error('[AI] Context error:', e); }
    }

    // Select Prompt
    let selectedPrompt: string;
    let expectStructured = false;

    switch (classification.type) {
      case 'GENERAL_KNOWLEDGE':
        selectedPrompt = COGNITIVE_CORE_PROMPT;
        break;
      case 'SYSTEM_ACTION':
      case 'SYSTEM_QUERY':
        selectedPrompt = SYSTEM_AGENT_PROMPT;
        expectStructured = true;
        break;
      case 'MIXED':
        selectedPrompt = HYBRID_PROMPT;
        expectStructured = classification.confidence >= 0.7;
        break;
      default:
        selectedPrompt = SYSTEM_PROMPT;
        expectStructured = true;
    }

    // Enhance with web search
    let enhancedMessage = message;
    if (webSearchEnabled) {
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
      } catch (e) { console.error('[AI] Web search error:', e); }
    }

    // Build final prompt
    const now = new Date();
    const timeCtx = `Time: ${now.toLocaleTimeString('en-US')}\nDate: ${now.toLocaleDateString('en-US')}`;
    const finalPrompt = `${selectedPrompt}\n\nCONTEXT:\n${timeCtx}\n${userContext}`;

    // Call AI
    const result = await callModelWithFallback(enhancedMessage, history || [], finalPrompt);
    let content = normalizeResponse(result.content);

    // Return based on intent
    if (classification.type === 'GENERAL_KNOWLEDGE' && !expectStructured) {
      return NextResponse.json({
        content,
        metadata: { intentType: classification.type, model: result.model }
      });
    }

    // Try JSON parse
    let parsed;
    try {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) parsed = JSON.parse(match[1].trim());
      else {
        const i = content.indexOf('{'), j = content.lastIndexOf('}');
        if (i !== -1 && j > i) parsed = JSON.parse(content.substring(i, j + 1));
      }
    } catch (e) { /* not JSON */ }

    if (parsed) {
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

    return NextResponse.json({
      content,
      metadata: { intentType: classification.type, model: result.model }
    });

  } catch (error) {
    console.error('[AI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
