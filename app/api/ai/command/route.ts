import { NextRequest, NextResponse } from 'next/server';
import { geminiAPI } from '@/lib/gemini';
import { ConversationMessage } from '@/types/ai';
import { AI_FUNCTION_DECLARATIONS } from '@/lib/ai-functions';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const commandRequestSchema = z.object({
  message: z.string().trim().min(1).max(12_000),
  context: z.string().max(20_000).optional().default(''),
  history: z.array(z.object({
    id: z.string().max(200),
    role: z.enum(['user', 'assistant']),
    content: z.string().max(12_000),
    timestamp: z.string().max(100),
    attachments: z.array(z.object({
      name: z.string().max(255),
      size: z.number().nonnegative().max(50_000_000),
      type: z.string().max(120),
      url: z.string().max(4_000),
    })).max(10).optional(),
  })).max(40).optional().default([]),
});

const SYSTEM_PROMPT = `You are a highly intelligent and helpful AI assistant integrated into a productivity application. Your goal is to assist the user with ANY request they might have.

CORE RESPONSIBILITIES:
1. **General Assistance**: You can answer questions on any topic, provide advice, explain concepts, write code, translate text, and help with general problem solving. Do not limit yourself to only productivity tasks.
2. **System Control**: You have access to tools to manage the user's productivity system (tasks, projects, habits, analytics). Use these tools when the user explicitly asks to modify or query their data.

AVAILABLE TOOLS:
- Task management (create, list, update, delete tasks)
- Project management (create, list projects)
- Habit tracking (create habits, log entries)
- Analytics (get productivity statistics)

INTERACTION STYLE:
- Be friendly, professional, and concise.
- If the user asks a general question (e.g., "How do I make a cake?", "Explain quantum physics"), answer it directly and helpfully.
- If the user asks to perform an action (e.g., "Create a task"), use the appropriate tool.
- If a request is ambiguous, ask for clarification.
- Always confirm successful actions with a brief summary.`;

// AI response using Gemini with function calling
const generateAIResponse = async (
  message: string,
  context: string,
  history: ConversationMessage[],
) => {
  console.log('[AI command] Authenticated request received.');

  try {
    // First call to Gemini with tools
    console.log('[AI command] Calling provider with declared tools.');
    let geminiResult = await geminiAPI.generateResponse(
      message,
      context,
      history,
      SYSTEM_PROMPT,
      AI_FUNCTION_DECLARATIONS
    );

    console.log('[AI command] Provider response received.');

    // If there are function calls, execute them
    if (geminiResult.functionCalls && geminiResult.functionCalls.length > 0) {
      // This legacy endpoint has no confirmation card or idempotency surface.
      // A model-selected function therefore remains a proposal; it must not
      // mutate tasks, Calendar or other user data merely because it appeared
      // in a provider response.
      return {
        response: 'Preparé una acción para tu revisión. Confírmala desde la experiencia de Novo antes de aplicarla.',
        functionResults: null,
        requiresConfirmation: true,
      };
    }

    // No function calls, return the response directly
    return {
      response: geminiResult.content,
      functionResults: null
    };
  } catch {
    console.error('[AI command] Inference failed.');
    return {
      response: 'Lo siento, no pude procesar tu solicitud en este momento. Inténtalo de nuevo.',
      functionResults: null
    };
  }
};

export async function POST(request: NextRequest) {
  try {
    console.log('[AI command] POST received.');

    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = commandRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { message, context, history } = parsed.data;

    const result = await generateAIResponse(
      message,
      context || '',
      history || [],
    );

    return NextResponse.json({
      response: result.response,
      functionResults: result.functionResults,
      requiresConfirmation: result.requiresConfirmation === true,
    });
  } catch {
    console.error('[AI command] Request failed.');
    return NextResponse.json(
      { error: 'InternalError', message: 'No se pudo completar la solicitud de IA.' },
      { status: 500 }
    );
  }
}
