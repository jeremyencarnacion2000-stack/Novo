import { Task } from './types';

import { Task } from './types';

export class TaskManager {
  async addTask(task: Task): Promise<void> {
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  }

  async getTasks(): Promise<Task[]> {
    try {
      const response = await fetch('/api/tasks');
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      return [];
    }
  }
}