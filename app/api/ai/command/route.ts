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
  console.log('DEBUG: generateAIResponse called with message:', message.substring(0, 100));

  try {
    // First call to Gemini with tools
    console.log('DEBUG: Calling geminiAPI with tools');
    let geminiResult = await geminiAPI.generateResponse(
      message,
      context,
      history,
      SYSTEM_PROMPT,
      AI_FUNCTION_DECLARATIONS
    );

    console.log('DEBUG: geminiAPI response:', geminiResult.content.substring(0, 200));
    console.log('DEBUG: Function calls:', geminiResult.functionCalls);

    // If there are function calls, execute them
    if (geminiResult.functionCalls && geminiResult.functionCalls.length > 0) {
      const functionResults = [];

      for (const functionCall of geminiResult.functionCalls) {
        console.log(`DEBUG: Executing function ${functionCall.name}`, functionCall.args);
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
      const updatedHistory = [
        ...history,
        { role: 'user' as const, content: message },
        { role: 'assistant' as const, content: `[Executed functions]\n${resultsSummary}` }
      ];

      // Second call to Gemini to generate natural language response
      console.log('DEBUG: Calling geminiAPI for natural response');
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
  } catch (error) {
    console.error('DEBUG: AI inference failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('CRITICAL AI ERROR:', errorMessage);
    return {
      response: `Lo siento, hubo un error al procesar tu mensaje. Detalles del error: ${errorMessage}`,
      functionResults: null
    };
  }
};

export async function POST(request: NextRequest) {
  try {
    console.log('DEBUG: POST request received at /api/ai/command');

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
      functionResults: result.functionResults
    });
  } catch (error) {
    console.error('Error in command API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}