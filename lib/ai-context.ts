import { DataIntegrator } from './data-integrator';
import { AIContext, Conversation } from '@/types/ai';
import { prisma } from './prisma';

// Helper to get data from localStorage safely
const getLocalData = <T,>(key: string, defaultValue?: T) => {
  if (typeof window === 'undefined') return defaultValue;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultValue;
};

export const getAIContext = async (userId: string): Promise<AIContext> => {
  const projects = getLocalData('novo_projects', []);
  const routines = getLocalData('novo_routines', []);
  const trackers = getLocalData('novo_trackers', []);
  const checklistItems = getLocalData('novo_checklist_items', []);
  const schoolSubjects = getLocalData('novo_school_subjects', []);
  const standaloneTasks = getLocalData('novo_standalone_tasks', []);
  const dailyTasks = await DataIntegrator.getDailyTasks(userId);

  return {
    projects: projects.map((p: any) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      priority: p.priority,
      dueDate: p.dueDate,
      progress: p.progress,
      subtasks: p.subtasks || [],
    })),
    routines: routines.map((r: any) => ({
      id: r.id,
      name: r.name,
      isActive: r.isActive,
      tasks: r.tasks || [],
    })),
    trackers: trackers.map((t: any) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      unit: t.unit,
      goal: t.goal,
      entries: t.entries || [],
    })),
    checklistItems,
    schoolSubjects,
    standaloneTasks: standaloneTasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
    })),
    dailyTasks: dailyTasks.map((t: any) => ({
      id: t.id,
      text: t.text,
      completed: t.completed,
      source: t.source,
      priority: t.priority,
    })),
  };
};

export const summarizeContext = (context: AIContext): string => {
  let summary = 'User Context Summary:\n\n';

  // Projects
  summary += `Projects (${context.projects.length}):\n`;
  context.projects.forEach(p => {
    summary += `- ${p.title} (${p.status}, ${p.priority} priority, ${p.progress}% complete`;
    if (p.dueDate) summary += `, due ${p.dueDate}`;
    summary += `, ${p.subtasks.filter(s => s.completed).length}/${p.subtasks.length} subtasks done)\n`;
  });

  // Routines
  const activeRoutines = context.routines.filter(r => r.isActive);
  summary += `\nActive Routines (${activeRoutines.length}):\n`;
  activeRoutines.forEach(r => {
    const completedTasks = r.tasks.filter(t => t.completed).length;
    summary += `- ${r.name} (${completedTasks}/${r.tasks.length} tasks completed)\n`;
  });

  // Trackers
  summary += `\nTrackers (${context.trackers.length}):\n`;
  context.trackers.forEach(t => {
    const latestEntry = t.entries[t.entries.length - 1];
    summary += `- ${t.name} (${t.type}, goal: ${t.goal}${t.unit ? ' ' + t.unit : ''}`;
    if (latestEntry) summary += `, latest: ${latestEntry.value} on ${latestEntry.date}`;
    summary += ')\n';
  });

  // Daily Tasks
  const pendingTasks = context.dailyTasks.filter(t => !t.completed);
  summary += `\nPending Daily Tasks (${pendingTasks.length}):\n`;
  pendingTasks.slice(0, 10).forEach(t => {
    summary += `- ${t.text} (${t.source}, ${t.priority})\n`;
  });
  if (pendingTasks.length > 10) summary += `- ... and ${pendingTasks.length - 10} more\n`;

  // School
  summary += `\nSchool Subjects (${context.schoolSubjects.length}):\n`;
  context.schoolSubjects.forEach(s => {
    const pendingEvents = s.events.filter(e => !e.completed);
    summary += `- ${s.name} (${pendingEvents.length} pending events)\n`;
  });

  return summary;
};

export const loadConversationHistory = async (userId: string): Promise<Conversation[]> => {
 try {
   const conversations = await prisma.conversation.findMany({
     where: { userId },
     include: {
       messages: {
         orderBy: { createdAt: 'asc' }
       }
     },
     orderBy: { updatedAt: 'desc' }
   });

   return conversations.map(conv => ({
     id: conv.id,
     title: conv.title || undefined,
     createdAt: conv.createdAt.toISOString(),
     updatedAt: conv.updatedAt.toISOString(),
     messages: conv.messages.map(msg => ({
       id: msg.id,
       role: msg.role as 'user' | 'assistant',
       content: msg.content,
       timestamp: msg.createdAt.toISOString()
     }))
   }));
 } catch (error) {
   console.error('Failed to load conversation history:', error);
   return [];
 }
};