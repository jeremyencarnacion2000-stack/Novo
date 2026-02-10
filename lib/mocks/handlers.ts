import { http, HttpResponse } from 'msw';

// Mock handlers for external APIs
export const handlers = [
  // Grok API mocks
  http.post('https://api.x.ai/v1/chat/completions', () => {
    return HttpResponse.json({
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      created: Date.now(),
      model: 'grok-1',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a mocked response from Grok AI.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    });
  }),

  // Groq API mocks
  http.post('https://api.groq.com/openai/v1/chat/completions', async ({ request }) => {
    const body = await request.json() as any;
    const model = body?.model;

    let content = 'This is a mocked response from Groq.';

    if (model === 'llama-3.1-8b-instant') {
      // System Agent mock
      content = JSON.stringify({
        analysis: "Mocked analysis",
        plan: [{ id: "1", label: "Mocked step", status: "pending" }],
        action: { type: "CREATE_TASK", payload: { title: "Mocked Task" } },
        message: "Mocked confirmation"
      });
    }

    return HttpResponse.json({
      choices: [
        {
          message: {
            role: 'assistant',
            content: content,
          },
        },
      ],
    });
  }),
];