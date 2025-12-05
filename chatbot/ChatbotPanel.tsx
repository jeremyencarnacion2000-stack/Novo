import './chat-styles.css';
import React, { useState, useEffect } from 'react';
import { ConversationMessage } from '@/types/ai';
import { sendChatMessage } from './chat-api';
import { Message, ChatMessages, ChatInput, TaskList, QuickTaskInput, Task } from './chat-ui';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

// Firebase config - replace with your actual config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: Date;
}

interface ChatbotPanelProps {
  isOpen?: boolean;
  isFocusModeActive?: boolean;
}

const SYSTEM_PROMPT = "Eres un asistente útil y amigable que responde en español. Puedes ayudar con tareas, responder preguntas y gestionar listas de tareas. Cuando el usuario mencione agregar una tarea, usa la función addTask.";

const ChatbotPanel: React.FC<ChatbotPanelProps> = ({ isOpen = false, isFocusModeActive = false }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('grok-beta');

  // Available AI models
  const availableModels = [
    { id: 'grok-beta', name: 'Grok Beta', provider: 'xAI' },
    { id: 'chutes/openai/gpt-oss-20b', name: 'GPT OSS 20B', provider: 'Chutes' }
  ];

  // Load conversations and tasks from Firebase on mount
  useEffect(() => {
    loadConversations();
    loadTasks();
  }, []);

  const loadConversations = async () => {
    try {
      const q = query(collection(db, 'conversations'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const convs: Conversation[] = [];
      querySnapshot.forEach((doc) => {
        convs.push({ id: doc.id, ...doc.data() } as Conversation);
      });
      setConversations(convs);
      if (convs.length > 0 && !currentConversationId) {
        setCurrentConversationId(convs[0].id);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const tsks: Task[] = [];
      querySnapshot.forEach((doc) => {
        tsks.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(tsks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const saveConversation = async (conversation: Conversation) => {
    try {
      if (conversation.id.startsWith('temp-')) {
        // New conversation
        const docRef = await addDoc(collection(db, 'conversations'), {
          ...conversation,
          createdAt: new Date(),
        });
        setConversations(prev => prev.map(c => c.id === conversation.id ? { ...c, id: docRef.id } : c));
        setCurrentConversationId(docRef.id);
      } else {
        // Update existing
        await updateDoc(doc(db, 'conversations', conversation.id), {
          messages: conversation.messages,
        });
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  };

  const saveTask = async (task: Task) => {
    try {
      if (task.id.startsWith('temp-')) {
        const docRef = await addDoc(collection(db, 'tasks'), task);
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, id: docRef.id } : t));
      } else {
        await updateDoc(doc(db, 'tasks', task.id), task);
      }
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const deleteTaskFromDB = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const getCurrentConversation = () => {
    return conversations.find(c => c.id === currentConversationId) || null;
  };

  const createNewConversation = () => {
    const newConv: Conversation = {
      id: `temp-${Date.now()}`,
      title: `Conversación ${conversations.length + 1}`,
      messages: [],
      createdAt: new Date(),
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
  };

  const handleSendMessage = async (message: string) => {
    const currentConv = getCurrentConversation();
    if (!currentConv) return;

    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    const updatedConv = {
      ...currentConv,
      messages: [...currentConv.messages, userMessage],
    };

    setConversations(prev => prev.map(c => c.id === currentConv.id ? updatedConv : c));
    setLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(message, '', updatedConv.messages, SYSTEM_PROMPT, selectedModel);

      const assistantMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
      };

      const finalConv = {
        ...updatedConv,
        messages: [...updatedConv.messages, assistantMessage],
      };

      setConversations(prev => prev.map(c => c.id === currentConv.id ? finalConv : c));
      saveConversation(finalConv);

      // Handle function calls
      if (response.functionCalls) {
        response.functionCalls.forEach(call => {
          if (call.name === 'addTask' && call.args.task) {
            handleAddTask(call.args.task);
          }
        });
      }
    } catch (err) {
      setError('Error al enviar el mensaje. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = (taskText: string) => {
    const newTask: Task = {
      id: `temp-${Date.now()}`,
      text: taskText,
      completed: false,
      createdAt: new Date(),
    };
    setTasks(prev => [newTask, ...prev]);
    saveTask(newTask);
  };

  const handleToggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask = { ...task, completed: !task.completed };
    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    saveTask(updatedTask);
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    deleteTaskFromDB(taskId);
  };

  const currentConv = getCurrentConversation();

  return (
    <div className={`chatbot-panel ${isOpen ? 'open' : ''}`}>
      <div className="chatbot-header">
        <h3>Chatbot AI</h3>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="model-selector"
        >
          {availableModels.map(model => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.provider})
            </option>
          ))}
        </select>
      </div>
      <div className="chatbot-content">
        <div className="conversation-sidebar">
          <button className="new-conversation-btn" onClick={createNewConversation}>
            Nueva
          </button>
          <ul className="conversation-list">
            {conversations.map((conv) => (
              <li
                key={conv.id}
                className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
                onClick={() => setCurrentConversationId(conv.id)}
              >
                {conv.title}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <ChatMessages messages={currentConv?.messages || []} />
          {loading && <div className="loading-indicator">Pensando...</div>}
          {error && <div className="error-message">{error}</div>}
          <ChatInput onSendMessage={handleSendMessage} disabled={loading} />
          <TaskList
            tasks={tasks}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
          />
          <QuickTaskInput onAddTask={handleAddTask} />
        </div>
      </div>
    </div>
  );
};

export default ChatbotPanel;