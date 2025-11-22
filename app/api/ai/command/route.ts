import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getAIContext, summarizeContext } from '@/lib/ai-context';
import { ConversationMessage } from '@/types/ai';
import { aiModelManager } from '@/lib/ai-models';
import { prisma } from '@/lib/prisma';

// AI response using custom models
const generateAIResponse = async (message: string, context: string, history: ConversationMessage[]) => {
  try {
    // Use custom model if available, fallback to mock
    const response = await aiModelManager.generateResponse(message, context, history);

    // Parse response for function calls (simplified - in real implementation, use proper parsing)
    const lowerMessage = message.toLowerCase();
    const lowerResponse = response.toLowerCase();

    let functionCall = null;

    if ((lowerMessage.includes('create a task') || lowerMessage.includes('add task')) &&
        lowerResponse.includes('created')) {
      functionCall = {
        name: 'create_task',
        arguments: { title: 'New Task', projectId: null }
      };
    }

    if ((lowerMessage.includes('add habit') || lowerMessage.includes('create habit')) &&
        lowerResponse.includes('added')) {
      functionCall = {
        name: 'create_habit',
        arguments: { name: 'New Habit', goal: 1 }
      };
    }

    return {
      response,
      functionCall
    };
  } catch (error) {
    console.error('AI inference failed:', error);
    // Fallback to mock response
    return mockAIResponse(message, context, history);
  }
};

// Fallback mock response
const mockAIResponse = (message: string, context: string, history: ConversationMessage[]) => {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('create a task') || lowerMessage.includes('add task')) {
    return {
      response: 'I\'ve created that task for you in your projects.',
      functionCall: {
        name: 'create_task',
        arguments: { title: 'New Task', projectId: null }
      }
    };
  }

  if (lowerMessage.includes('add habit') || lowerMessage.includes('create habit')) {
    return {
      response: 'I\'ve added that habit to your trackers.',
      functionCall: {
        name: 'create_habit',
        arguments: { name: 'New Habit', goal: 1 }
      }
    };
  }

  return {
    response: `I understand you said: "${message}". Based on your context, I can help you manage your tasks, habits, and more. What would you like me to do?`,
    functionCall: null
  };
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, conversationId } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Find or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: session.user.id
        }
      });
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          userId: session.user.id,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : '')
        }
      });
    }

    // Retrieve existing messages ordered by createdAt
    const existingMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' }
    });

    // Convert to ConversationMessage format
    const history: ConversationMessage[] = existingMessages.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: msg.createdAt.toISOString()
    }));

    // Get user context
    const context = await getAIContext(session.user.id);
    const contextSummary = summarizeContext(context);

    // Store user message in database
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message
      }
    });

    // Get AI response using custom model
    const aiResult = await generateAIResponse(message, contextSummary, history);

    // If there's a function call, execute it
    let functionResult = null;
    if (aiResult.functionCall) {
      functionResult = await executeFunction(aiResult.functionCall, session.user.id);
    }

    // Store AI response in database
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: aiResult.response
      }
    });

    return NextResponse.json({
      response: aiResult.response,
      functionResult,
      conversationId: conversation.id
    });

  } catch (error) {
    console.error('AI command error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Function execution layer
async function executeFunction(functionCall: any, userId: string) {
  const { name, arguments: args } = functionCall;

  switch (name) {
    case 'create_task':
      // Implement task creation using database
      const newTask = await prisma.task.create({
        data: {
          title: args.title,
          status: 'todo',
          priority: 'medium',
          tags: '[]',
          userId: userId
        }
      });
      return { success: true, task: newTask };

    case 'create_habit':
      // Implement habit creation using database
      const newHabit = await prisma.tracker.create({
        data: {
          name: args.name,
          type: 'habit',
          unit: 'times',
          goal: args.goal,
          userId: userId
        }
      });
      return { success: true, habit: newHabit };

    default:
      return { success: false, error: 'Unknown function' };
  }
}