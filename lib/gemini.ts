import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { ConversationMessage } from '@/types/ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY env var is not set')

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface GeminiTool {
  functionDeclarations: {
    name: string;
    description: string;
    parameters?: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  }[];
}

export class GeminiAPIClient {
  private static instance: GeminiAPIClient;
  private genAI: GoogleGenerativeAI;

  private constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }

  static getInstance(): GeminiAPIClient {
    if (!GeminiAPIClient.instance) {
      GeminiAPIClient.instance = new GeminiAPIClient();
    }
    return GeminiAPIClient.instance;
  }

  async generateResponse(
    message: string,
    context: string,
    history: ConversationMessage[] = [],
    systemPrompt?: string,
    tools?: any[] // Function declarations
  ): Promise<{ content: string; functionCalls: GeminiFunctionCall[] }> {
    try {
      // Configure model with tools if provided
      const modelConfig: any = { model: 'gemini-2.5-flash' };

      // Add tools if provided
      if (tools && tools.length > 0) {
        modelConfig.tools = [{
          functionDeclarations: tools
        }];
      }

      const model = this.genAI.getGenerativeModel(modelConfig);

      // Convert history to Gemini format, adding system prompt as first user message if provided
      const chatHistory = [];

      // If there's a system prompt, add it as the first exchange
      if (systemPrompt) {
        chatHistory.push({
          role: 'user',
          parts: [{ text: systemPrompt }]
        });
        chatHistory.push({
          role: 'model',
          parts: [{ text: 'Understood. I will follow these instructions.' }]
        });
      }

      // Add conversation history
      history.forEach(msg => {
        chatHistory.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      });

      // Start chat
      const chat = model.startChat({
        history: chatHistory,
        generationConfig: {
          maxOutputTokens: 2000,
        },
      });

      // Send message
      const result = await chat.sendMessage(message);
      const response = await result.response;

      // Handle function calls if any
      const functionCalls: GeminiFunctionCall[] = [];
      const calls = response.functionCalls();
      if (calls && calls.length > 0) {
        calls.forEach(call => {
          functionCalls.push({
            name: call.name,
            args: call.args as Record<string, any>
          });
        });

        // Return empty content if there are function calls
        // The API will handle function execution and send results back
        return { content: '', functionCalls };
      }

      const text = response.text();
      return { content: text, functionCalls };

    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const geminiAPI = GeminiAPIClient.getInstance();