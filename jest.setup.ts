/// <reference types="jest" />
import '@testing-library/jest-dom';
import fetch from 'node-fetch';

if (!globalThis.fetch) {
  (globalThis as any).fetch = fetch;
  (globalThis as any).Request = (fetch as any).Request;
  (globalThis as any).Response = (fetch as any).Response;
  (globalThis as any).Headers = (fetch as any).Headers;
}

// Mock Prisma
jest.mock('./lib/prisma', () => ({
  prisma: {
    task: {
      create: jest.fn().mockResolvedValue({ id: 'mock-task-id', title: 'Mock Task' }),
      update: jest.fn().mockResolvedValue({ id: 'mock-task-id', title: 'Updated Task' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
    },
    routine: {
      create: jest.fn().mockResolvedValue({ id: 'mock-routine-id', name: 'Mock Routine', days: [] }),
      findUnique: jest.fn().mockResolvedValue({ id: 'mock-routine-id', name: 'Mock Routine', days: [] }),
    },
    quickNote: {
      create: jest.fn().mockResolvedValue({ id: 'mock-note-id', content: 'Mock Note' }),
    },
    workoutLog: {
      create: jest.fn().mockResolvedValue({ id: 'mock-log-id' }),
      count: jest.fn().mockResolvedValue(10),
    }
  }
}));

// Global fetch mock for AI tests
const originalFetch = globalThis.fetch;
(globalThis as any).fetch = jest.fn(async (url, options) => {
  if (url.includes('api.groq.com')) {
    const body = JSON.parse(options.body);
    const model = body.model;

    let content = 'This is a mocked response from Groq.';

    if (model === 'llama-3.1-8b-instant') {
      const isCritical = body.messages[1].content.toLowerCase().includes('borra');
      content = JSON.stringify({
        analysis: "Mocked analysis",
        plan: [{ id: "1", label: "Mocked step", status: "pending" }],
        action: { name: isCritical ? "DELETE_ALL_TASKS" : "CREATE_TASK", payload: isCritical ? {} : { title: "Mocked Task" } },
        message: "Mocked confirmation"
      });
    }

    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content } }]
      }),
      text: async () => JSON.stringify({ choices: [{ message: { content } }] })
    };
  }
  return originalFetch(url, options);
});

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: '',
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    };
  },
}));

// Mock next/navigation for Next.js 13+
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));