import { Task } from './types';

export class TaskManager {
  addTask(task: Task): void {
    const tasks = this.getTasks();
    tasks.push(task);
    localStorage.setItem('quickTasks', JSON.stringify(tasks));
  }

  private getTasks(): Task[] {
    const stored = localStorage.getItem('quickTasks');
    return stored ? JSON.parse(stored) : [];
  }
}