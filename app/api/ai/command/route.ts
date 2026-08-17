import { NextRequest, NextResponse } from 'next/server';
import { geminiAPI } from '@/lib/gemini';
import { ConversationMessage } from '@/types/ai';
import { AI_FUNCTION_DECLARATIONS, executeFunctionCall } from '@/lib/ai-functions';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
  userId: string
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

      const functionResults = [];

      for (const functionCall of geminiResult.functionCalls) {
        console.log('[AI command] Executing declared function.', { name: functionCall.name });
        const result = await executeFunctionCall(
          functionCall.name,
          functionCall.args,
          userId
        );
        functionResults.push({
          name: functionCall.name,
          result
        });
      }

      // Create a summary of function results
      const resultsSummary = functionResults
        .map(fr => `Function ${fr.name}: ${fr.result.message}`)
        .join('\n');

      // Add function results to history and ask Gemini to respond
      const updatedHistory: ConversationMessage[] = [
        ...history,
        { id: 'msg-' + Date.now(), role: 'user' as const, content: message, timestamp: new Date().toISOString() },
        { id: 'msg-' + (Date.now() + 1), role: 'assistant' as const, content: `[Executed functions]\n${resultsSummary}`, timestamp: new Date().toISOString() }
      ];

      // Second call to Gemini to generate natural language response
      console.log('[AI command] Composing post-tool response.');
      geminiResult = await geminiAPI.generateResponse(
        'Based on the function execution results above, provide a clear and friendly response to the user explaining what was done.',
        context,
        updatedHistory,
        SYSTEM_PROMPT
      );

      return {
        response: geminiResult.content,
        functionResults
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

    const body = await request.json();
    const { message, context, history } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const result = await generateAIResponse(
      message,
      context || '',
      history || [],
      session.user.id
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
