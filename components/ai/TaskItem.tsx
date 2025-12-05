import React from 'react';
import { Check, Trash2, Clock, AlertCircle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <Check className="h-4 w-4 text-green-500" />;
      case 'in-progress': return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      task.status === 'done' ? 'bg-muted/50 border-muted' : 'bg-card border-border hover:bg-accent/50'
    } ${isOverdue ? 'border-red-200 bg-red-50/50' : ''}`}>
      <button
        onClick={() => onToggle(task.id)}
        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          task.status === 'done'
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 hover:border-primary'
        }`}
        aria-label={task.status === 'done' ? 'Marcar como pendiente' : 'Marcar como completada'}
      >
        {task.status === 'done' && <Check className="h-3 w-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </span>
          {getStatusIcon(task.status)}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)} bg-current/10`}>
            {task.priority}
          </span>
          {task.dueDate && (
            <span className={`text-xs ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-1">
              {task.tags.slice(0, 2).map((tag, index) => (
                <span key={index} className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded">
                  {tag}
                </span>
              ))}
              {task.tags.length > 2 && (
                <span className="text-xs text-muted-foreground">+{task.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(task.id)}
        className="flex-shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
        aria-label="Eliminar tarea"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}