export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: FileAttachment[];
}

export interface FileAttachment {
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface AIModel {
  id: string;
  name: string;
  type: 'lora' | 'base' | 'api';
  baseModel?: string; // For LoRA models
  filePath: string;
  uploadedAt: string;
  size: number;
  isActive: boolean;
}

export interface AIInferenceResult {
  response: string;
  functionCall?: {
    name: string;
    arguments: any;
  };
}

export interface Conversation {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

export interface AIContext {
  projects: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: string;
    progress: number;
    subtasks: { id: string; title: string; completed: boolean }[];
  }[];
  routines: {
    id: string;
    name: string;
    isActive: boolean;
    tasks: { id: string; text: string; completed: boolean }[];
  }[];
  trackers: {
    id: string;
    name: string;
    type: string;
    unit: string;
    goal: number;
    entries: { date: string; value: number }[];
  }[];
  checklistItems: {
    id: string;
    text: string;
    completed: boolean;
    priority: string;
  }[];
  schoolSubjects: {
    id: string;
    name: string;
    events: { id: string; title: string; date: string; type: string; completed: boolean }[];
  }[];
  standaloneTasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: string;
  }[];
  dailyTasks: {
    id: string;
    text: string;
    completed: boolean;
    source: string;
    priority: string;
  }[];
  conversations?: Conversation[];
}