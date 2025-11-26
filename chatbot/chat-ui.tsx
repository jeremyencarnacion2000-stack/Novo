import React from 'react';
import { ConversationMessage } from '@/types/ai';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

interface MessageProps {
  message: ConversationMessage;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  const renderContent = (content: string) => {
    if (content.includes('```')) {
      // Simple code block detection
      const parts = content.split('```');
      return parts.map((part, index) => {
        if (index % 2 === 1) {
          // Code block
          return <pre key={index} style={{ whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: '8px', borderRadius: '4px' }}>{part}</pre>;
        }
        return <span key={index}>{part}</span>;
      });
    }
    return <span>{content}</span>;
  };

  return (
    <div className={`message ${isUser ? 'user' : 'bot'}`}>
      <div>{renderContent(message.content)}</div>
      <span className="timestamp">{new Date(message.timestamp).toLocaleTimeString()}</span>
    </div>
  );
};

interface TaskListProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, onToggleTask, onDeleteTask }) => {
  return (
    <div className="task-list">
      <h4>Tareas</h4>
      {tasks.length === 0 ? (
        <p>No hay tareas pendientes.</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => onToggleTask(task.id)}
              />
              <span>{task.text}</span>
              <button onClick={() => onDeleteTask(task.id)}>Eliminar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface QuickTaskInputProps {
  onAddTask: (task: string) => void;
}

const QuickTaskInput: React.FC<QuickTaskInputProps> = ({ onAddTask }) => {
  const [taskText, setTaskText] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (taskText.trim()) {
      onAddTask(taskText.trim());
      setTaskText('');
    }
  };

  return (
    <form className="quick-task-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={taskText}
        onChange={(e) => setTaskText(e.target.value)}
        placeholder="Agregar tarea rápida..."
      />
      <button type="submit">Agregar</button>
    </form>
  );
};

interface ChatMessagesProps {
  messages: ConversationMessage[];
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages }) => {
  return (
    <div className="chat-messages">
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}
    </div>
  );
};

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled = false }) => {
  const [inputValue, setInputValue] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !disabled) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Escribe tu mensaje..."
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !inputValue.trim()}>
        Enviar
      </button>
    </form>
  );
};

export { Message, ChatMessages, ChatInput, TaskList, QuickTaskInput };
export type { Task };