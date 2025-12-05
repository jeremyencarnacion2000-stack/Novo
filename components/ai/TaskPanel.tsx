import React, { useState } from 'react';
import { Plus, ListTodo, ChevronDown, ChevronUp } from 'lucide-react';
import { TaskItem } from './TaskItem';

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

interface TaskPanelProps {
  tasks: Task[];
  onAddTask: (title: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function TaskPanel({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  isCollapsed = false,
  onToggleCollapse
}: TaskPanelProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      onAddTask(newTaskTitle.trim());
      setNewTaskTitle('');
    }
  };

  const pendingTasks = tasks.filter(task => task.status !== 'done');
  const completedTasks = tasks.filter(task => task.status === 'done');

  return (
    <div className="bg-card border-t border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Tareas</h3>
            <span className="text-sm text-muted-foreground bg-secondary px-2 py-1 rounded">
              {pendingTasks.length} pendiente{pendingTasks.length !== 1 ? 's' : ''}
            </span>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isCollapsed ? "Expandir panel de tareas" : "Colapsar panel de tareas"}
            >
              {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Quick Add Task */}
          <div className="p-4 border-b border-border">
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Agregar nueva tarea..."
                className="flex-1 px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                aria-label="Nueva tarea"
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Agregar tarea"
              >
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Tasks List */}
          <div className="max-h-96 overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <ListTodo className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No hay tareas aún</p>
                <p className="text-xs mt-1">Agrega tu primera tarea arriba</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {/* Pending Tasks */}
                {pendingTasks.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Pendientes</h4>
                    <div className="space-y-2">
                      {pendingTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onToggle={onToggleTask}
                          onDelete={onDeleteTask}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Tasks */}
                {completedTasks.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Completadas</h4>
                    <div className="space-y-2">
                      {completedTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onToggle={onToggleTask}
                          onDelete={onDeleteTask}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}