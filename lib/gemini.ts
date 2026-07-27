import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConversationMessage } from '@/types/ai';

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

// Fallback models in priority order.
// 'gemini-flash-latest' points to Google's current active stable flash model.
const FALLBACK_MODELS = [
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

export class GeminiAPIClient {
  private static instance: GeminiAPIClient;

  private getGenAI(): GoogleGenerativeAI {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY env var is not set');
    }
    return new GoogleGenerativeAI(key);
  }

  static getInstance(): GeminiAPIClient {
    if (!GeminiAPIClient.instance) {
      GeminiAPIClient.instance = new GeminiAPIClient();
    }
    return GeminiAPIClient.instance;
  }

  async generateResponse(
    message: string,
    context?: string,
    history: ConversationMessage[] = [],
    systemPrompt?: string,
    tools?: any[],
    preferredModel?: string
  ): Promise<{ content: string; functionCalls: GeminiFunctionCall[] }> {
    const genAI = this.getGenAI();

    const candidateModels = preferredModel
      ? [preferredModel, ...FALLBACK_MODELS.filter(m => m !== preferredModel)]
      : FALLBACK_MODELS;

    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const modelConfig: any = { model: modelName };

        if (systemPrompt) {
          modelConfig.systemInstruction = systemPrompt;
        }

        if (tools && tools.length > 0) {
          modelConfig.tools = [{
            functionDeclarations: tools
          }];
        }

        const model = genAI.getGenerativeModel(modelConfig);

        const chatHistory = history.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({
          history: chatHistory,
          generationConfig: {
            maxOutputTokens: 2000,
          },
        });

        const prompt = context ? `[Context: ${context}]\n\n${message}` : message;
        const result = await chat.sendMessage(prompt);
        const response = await result.response;

        const functionCalls: GeminiFunctionCall[] = [];
        const calls = response.functionCalls();
        if (calls && calls.length > 0) {
          calls.forEach(call => {
            functionCalls.push({
              name: call.name,
              args: call.args as Record<string, any>
            });
          });
          return { content: '', functionCalls };
        }

        const text = response.text();
        return { content: text, functionCalls };
      } catch (error: any) {
        console.warn(`[GeminiAPIClient] Model ${modelName} failed, trying next fallback:`, error?.message || error);
        lastError = error;
      }
    }

    throw new Error(`Gemini API error across all candidate models: ${lastError?.message || String(lastError)}`);
  }
}

export const geminiAPI = GeminiAPIClient.getInstance();