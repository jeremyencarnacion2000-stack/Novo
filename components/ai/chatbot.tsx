'use client';

import React, { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import { Send, Bot, User, MessageSquare, Trash2, Plus, Paperclip, X, Menu, AlertCircle, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { ConversationMessage } from '@/types/ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

interface FileAttachment {
  name: string;
  size: number;
  type: string;
  url: string;
}

type ErrorType = 'network' | 'api' | 'validation' | 'timeout' | 'unknown';

interface ErrorState {
  type: ErrorType;
  message: string;
  details?: string;
}

interface LoadingState {
  type: 'sending' | 'receiving' | 'saving' | 'loading' | 'deleting';
  message: string;
}

type Tool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
};

export function GrokChatbot() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [error, setError] = useState<ErrorState | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  // Function tools definitions
  const tools: Tool[] = [
    {
      type: 'function',
      function: {
        name: 'create_task',
        description: 'Crear una nueva tarea en el sistema',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Título de la tarea' },
            status: { type: 'string', enum: ['todo', 'in-progress', 'done'], description: 'Estado de la tarea' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Prioridad de la tarea' },
            dueDate: { type: 'string', description: 'Fecha de vencimiento en formato ISO' },
            projectId: { type: 'string', description: 'ID del proyecto asociado' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Etiquetas de la tarea' }
          },
          required: ['title']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_project',
        description: 'Crear un nuevo proyecto en el sistema',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Título del proyecto' },
            description: { type: 'string', description: 'Descripción del proyecto' },
            status: { type: 'string', enum: ['not-started', 'in-progress', 'completed'], description: 'Estado del proyecto' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Prioridad del proyecto' },
            startDate: { type: 'string', description: 'Fecha de inicio en formato ISO' },
            dueDate: { type: 'string', description: 'Fecha de vencimiento en formato ISO' },
            progress: { type: 'number', description: 'Progreso del proyecto (0-100)' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Etiquetas del proyecto' },
            subtasks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, completed: { type: 'boolean' } } }, description: 'Subtareas del proyecto' },
            notes: { type: 'string', description: 'Notas adicionales del proyecto' }
          },
          required: ['title']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_routine',
        description: 'Crear una nueva rutina en el sistema',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nombre de la rutina' },
            description: { type: 'string', description: 'Descripción de la rutina' },
            timeOfDay: { type: 'string', enum: ['morning', 'afternoon', 'evening', 'night'], description: 'Momento del día para la rutina' },
            duration: { type: 'number', description: 'Duración en minutos' },
            tasks: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, completed: { type: 'boolean' } } }, description: 'Tareas de la rutina' }
          },
          required: ['name', 'timeOfDay', 'duration']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_task',
        description: 'Actualizar una tarea existente',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID de la tarea a actualizar' },
            title: { type: 'string', description: 'Nuevo título de la tarea' },
            status: { type: 'string', enum: ['todo', 'in-progress', 'done'], description: 'Nuevo estado de la tarea' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Nueva prioridad de la tarea' },
            dueDate: { type: 'string', description: 'Nueva fecha de vencimiento en formato ISO' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Nuevas etiquetas de la tarea' }
          },
          required: ['id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_system_status',
        description: 'Consultar el estado actual del sistema (tareas, proyectos, rutinas)',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_weekly_summary',
        description: 'Obtener un resumen semanal de tareas, rutinas y hábitos completados',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_productivity_analysis',
        description: 'Analizar la productividad del usuario (puntuación, horas pico)',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }
  ];
  // Error handling helpers
  const handleError = (error: any, context: string) => {
    console.error(`Error in ${context}:`, error);

    let errorType: ErrorType = 'unknown';
    let message = 'Ha ocurrido un error inesperado.';
    let details = '';

    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorType = 'network';
      message = 'Error de conexión. Verifica tu conexión a internet.';
      details = 'No se pudo conectar al servidor. Inténtalo de nuevo.';
    } else if (error instanceof Response) {
      if (error.status >= 400 && error.status < 500) {
        errorType = 'validation';
        message = 'Error de validación en los datos enviados.';
        details = `Código de error: ${error.status}`;
      } else if (error.status >= 500) {
        errorType = 'api';
        message = 'Error del servidor. Inténtalo más tarde.';
        details = `Error interno del servidor (${error.status})`;
      }
    } else if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      errorType = 'timeout';
      message = 'La solicitud ha expirado. Inténtalo de nuevo.';
      details = 'El servidor tardó demasiado en responder.';
    } else if (error.message) {
      message = error.message;
      details = error.stack || '';
    }

    setError({ type: errorType, message, details });
    setTimeout(() => setError(null), 5000); // Auto-dismiss after 5 seconds
  };

  const setLoading = (type: LoadingState['type'], message: string) => {
    setLoadingState({ type, message });
  };

  const clearLoading = () => {
    setLoadingState(null);
  };

  // Function execution helpers
  const executeFunction = async (name: string, args: Record<string, any>) => {
    try {
      switch (name) {
        case 'create_task':
          return await createTask(args);
        case 'create_project':
          return await createProject(args);
        case 'create_routine':
          return await createRoutine(args);
        case 'update_task':
          return await updateTask(args);
        case 'get_system_status':
          return await getSystemStatus();
        case 'get_weekly_summary':
          return await getWeeklySummary();
        case 'get_productivity_analysis':
          return await getProductivityAnalysis();
        default:
          throw new Error(`Función desconocida: ${name}`);
      }
    } catch (error) {
      console.error(`Error ejecutando función ${name}:`, error);
      return { error: `Error ejecutando ${name}: ${error instanceof Error ? error.message : String(error)}` };
    }
  };

  const createTask = async (args: any) => {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    if (!response.ok) throw new Error(`Error creando tarea: ${response.statusText}`);
    return await response.json();
  };

  const createProject = async (args: any) => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    if (!response.ok) throw new Error(`Error creando proyecto: ${response.statusText}`);
    return await response.json();
  };

  const createRoutine = async (args: any) => {
    const response = await fetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    if (!response.ok) throw new Error(`Error creando rutina: ${response.statusText}`);
    return await response.json();
  };

  const updateTask = async (args: any) => {
    // Since there's no individual task update API, we'll create a new task with updated info
    // In a real implementation, you'd have a PUT /api/tasks/[id] endpoint
    const { id, ...updateData } = args;
    // For now, just return a mock response
    return { message: `Tarea ${id} actualizada (simulado)`, updateData };
  };

  const getSystemStatus = async () => {
    const [tasksRes, projectsRes, routinesRes] = await Promise.all([
      fetch('/api/tasks'),
      fetch('/api/projects'),
      fetch('/api/routines')
    ]);

    const tasks = tasksRes.ok ? await tasksRes.json() : [];
    const projects = projectsRes.ok ? await projectsRes.json() : [];
    const routines = routinesRes.ok ? await routinesRes.json() : [];

    return {
      tasks: { count: tasks.length, items: tasks.slice(0, 5) },
      projects: { count: projects.length, items: projects.slice(0, 5) },
      routines: { count: routines.length, items: routines.slice(0, 5) }
    };
  };

  const getWeeklySummary = async () => {
    const response = await fetch('/api/stats/productivity?days=7');
    if (!response.ok) throw new Error('Failed to fetch weekly summary');
    return await response.json();
  };

  const getProductivityAnalysis = async () => {
    const response = await fetch('/api/stats/productivity?days=30');
    if (!response.ok) throw new Error('Failed to fetch productivity analysis');
    return await response.json();
  };

  // Componente para bloques de código con syntax highlighting
  const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  };

  // Load conversations from API
  const loadConversations = async () => {
    try {
      setLoading('loading', 'Cargando conversaciones...');
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      } else {
        handleError(response, 'loadConversations');
      }
    } catch (error) {
      handleError(error, 'loadConversations');
    } finally {
      clearLoading();
    }
  };

  // Save conversation to API
  const saveConversation = async (conversation: Conversation) => {
    try {
      setLoading('saving', 'Guardando conversación...');
      const method = conversation.id.startsWith('temp_') ? 'POST' : 'PUT';
      const url = method === 'POST' ? '/api/conversations' : `/api/conversations/${conversation.id}`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: conversation.title,
          messages: conversation.messages
        })
      });

      if (response.ok) {
        const savedConversation = await response.json();
        return savedConversation;
      } else {
        handleError(response, 'saveConversation');
      }
    } catch (error) {
      handleError(error, 'saveConversation');
    } finally {
      clearLoading();
    }
    return null;
  };

  // Start new conversation
  const startNewConversation = async () => {
    const tempId = `temp_${Date.now()}`;
    const newConv: Conversation = {
      id: tempId,
      title: 'Nueva conversación',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setConversations(prev => [newConv, ...prev]);
    setCurrentConversation(tempId);
    setMessages([]);
    setAttachments([]);
  };

  // Select conversation
  const selectConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversation(id);
      setMessages(conv.messages);
      setAttachments([]);
    }
  };

  // Delete conversation
  const deleteConversation = async (id: string) => {
    try {
      setLoading('deleting', 'Eliminando conversación...');
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (currentConversation === id) {
          setCurrentConversation(null);
          setMessages([]);
          setAttachments([]);
        }
      } else {
        handleError(response, 'deleteConversation');
      }
    } catch (error) {
      handleError(error, 'deleteConversation');
    } finally {
      clearLoading();
    }
  };

  // Handle file attachment
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newAttachments: FileAttachment[] = [];
      const maxSize = 10 * 1024 * 1024; // 10MB
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Validate file type and size
        const isAllowedType = file.type.startsWith('image/') ||
          file.type.startsWith('text/') ||
          file.type === 'application/pdf' ||
          file.type === 'application/msword' ||
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        if (!isAllowedType || file.size > maxSize) {
          continue; // Skip invalid files
        }
        // Read file as base64 for API
        const url = URL.createObjectURL(file);
        newAttachments.push({
          name: file.name,
          size: file.size,
          type: file.type,
          url
        });
      }
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const newAttachments = [...prev];
      URL.revokeObjectURL(newAttachments[index].url);
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  };

  // Typing effect
  const typeText = (text: string, callback: () => void) => {
    // Clear any existing typing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    setIsTyping(true);
    setTypingText('');
    let index = 0;

    typingIntervalRef.current = setInterval(() => {
      if (index < text.length) {
        setTypingText(prev => prev + text[index]);
        index++;
      } else {
        clearInterval(typingIntervalRef.current!);
        typingIntervalRef.current = null;
        setIsTyping(false);
        callback();
      }
    }, 5); // 5ms per character for faster typing
  };

  // Send message with Grok API
  const sendMessage = useCallback(async () => {
    if (!input.trim() && attachments.length === 0 || isLoading) return;

    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      attachments: attachments.length > 0 ? attachments : undefined
    };

    const newMessages = [...messages, userMessage];
    // Batch initial state updates
    setMessages(newMessages);
    setInput('');
    setAttachments([]);
    setIsLoading(true);
    setLoading('sending', 'Enviando mensaje...');

    // Save conversation with user message
    let currentConv = conversations.find(c => c.id === currentConversation);
    if (currentConv) {
      currentConv.messages = newMessages;
      currentConv.updatedAt = new Date().toISOString();
      if (currentConv.title === 'Nueva conversación' && input.trim()) {
        currentConv.title = input.trim().length > 30 ? input.trim().slice(0, 30) + '...' : input.trim();
      }
      await saveConversation(currentConv);
    }

    try {
      clearLoading();
      setLoading('receiving', 'Procesando respuesta...');

      // Prepare history for API
      const history = newMessages.slice(0, -1);

      // Call Grok API
      const systemPrompt = `Eres un asistente útil que responde en español. Proporciona respuestas detalladas y útiles.

Tienes acceso a las siguientes funciones para interactuar con el sistema Novo Desktop MVP:
- create_task: Crear una nueva tarea
- create_project: Crear un nuevo proyecto
- create_routine: Crear una nueva rutina
- update_task: Actualizar una tarea existente
- get_system_status: Consultar el estado actual del sistema
- get_weekly_summary: Obtener un resumen semanal de tareas, rutinas y hábitos completados
- get_productivity_analysis: Analizar la productividad del usuario (puntuación, horas pico)

Usa estas funciones cuando el usuario te pida realizar acciones relacionadas con tareas, proyectos o rutinas.`;

      console.log('Chatbot: Enviando mensaje a /api/ai/generate', {
        mensaje: userMessage.content.slice(0, 100) + (userMessage.content.length > 100 ? '...' : ''),
        longitudHistorial: history.length,
        longitudPromptSistema: systemPrompt.length,
        cantidadHerramientas: tools.length
      });

      const fetchResponse = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history,
          systemPrompt,
          tools
        })
      });

      if (!fetchResponse.ok) {
        throw new Error(`Error generating response: ${fetchResponse.statusText}`);
      }

      const data = await fetchResponse.json();

      console.log('Chatbot: Datos recibidos de API', data);

      // Validate API response format
      if (data === null || !data || typeof data !== 'object') {
        throw new Error('Respuesta de API inválida: formato inesperado');
      }

      if (!data.content || typeof data.content !== 'string') {
        throw new Error('Respuesta de API inválida: contenido faltante o formato incorrecto');
      }

      const aiMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString()
      };

      clearLoading();
      // LOG: Verificar el contenido antes de typeText
      console.log('Chatbot: Preparando typeText con contenido:', {
        dataContent: data.content?.slice(0, 100),
        aiMessageContent: aiMessage.content?.slice(0, 100),
        responseType: typeof fetchResponse,
        hasResponseContent: 'content' in fetchResponse,
        dataHasContent: 'content' in data,
        dataContentIsString: typeof data.content === 'string'
      });

      // Start typing effect
      startTransition(() => {
        typeText(data.content, () => {
          const finalMessages = [...newMessages, aiMessage];
          setMessages(finalMessages);

          // Update conversation
          if (currentConv) {
            currentConv.messages = finalMessages;
            currentConv.updatedAt = new Date().toISOString();
            saveConversation(currentConv);
          }
        });
      });

    } catch (error) {
      handleError(error, 'sendMessage');
      const errorMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor, inténtalo de nuevo.',
        timestamp: new Date().toISOString()
      };

      typeText(errorMessage.content, () => {
        setMessages(prev => [...prev, errorMessage]);
      });
    } finally {
      setIsLoading(false);
      clearLoading();
    }
  }, [input, attachments, messages, currentConversation, conversations, isLoading, tools, typeText, saveConversation, handleError]);

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus input with Ctrl/Cmd + K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }

      // Navigate conversations with arrow keys when sidebar is focused
      if (document.activeElement?.closest('[data-sidebar]')) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const conversationsElements = document.querySelectorAll('[data-conversation]');
          const currentIndex = Array.from(conversationsElements).findIndex(el =>
            el === document.activeElement
          );

          let nextIndex;
          if (e.key === 'ArrowDown') {
            nextIndex = currentIndex < conversationsElements.length - 1 ? currentIndex + 1 : 0;
          } else {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : conversationsElements.length - 1;
          }

          (conversationsElements[nextIndex] as HTMLElement)?.focus();
        } else if (e.key === 'Enter') {
          (document.activeElement as HTMLElement)?.click();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [conversations]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Cleanup typing interval on unmount
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);


  return (
    <div className="flex h-full bg-background">
      {/* Error Banner */}
      {error && (
        <div
          className="fixed top-4 right-4 z-50 max-w-sm bg-destructive text-destructive-foreground p-4 rounded-lg shadow-lg border border-destructive-foreground/20"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{error.message}</p>
              {error.details && <p className="text-xs opacity-90 mt-1">{error.details}</p>}
            </div>
            <button
              onClick={() => setError(null)}
              className="text-destructive-foreground/70 hover:text-destructive-foreground"
              aria-label="Cerrar mensaje de error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loadingState && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm font-medium">{loadingState.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar de conversaciones */}
      <div
        className={`${sidebarCollapsed ? 'w-0 md:w-16' : 'w-80'
          } bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out`}
        data-sidebar
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          {!sidebarCollapsed && (
            <button
              onClick={startNewConversation}
              className="flex items-center gap-2 w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              aria-label="Crear nueva conversación"
            >
              <Plus className="h-4 w-4" />
              Nueva conversación
            </button>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors md:hidden"
            aria-label={sidebarCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-accent transition-colors ${currentConversation === conv.id ? 'bg-accent border border-border' : ''
                  }`}
                data-conversation
                tabIndex={0}
                role="button"
                aria-label={`Seleccionar conversación: ${conv.title}`}
                aria-selected={currentConversation === conv.id}
              >
                <button
                  onClick={() => selectConversation(conv.id)}
                  className="flex-1 text-left truncate"
                  aria-hidden="true"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    {!sidebarCollapsed && <span className="text-sm font-medium">{conv.title}</span>}
                  </div>
                </button>
                {!sidebarCollapsed && (
                  <button
                    onClick={() => deleteConversation(conv.id)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Eliminar conversación: ${conv.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Área de chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Grok Chatbot
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {navigator.onLine ? (
                <div className="flex items-center gap-1">
                  <Wifi className="h-3 w-3 text-green-500" />
                  <span>Conectado</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <WifiOff className="h-3 w-3 text-red-500" />
                  <span>Sin conexión</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mensajes */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4"
          role="log"
          aria-live="polite"
          aria-label="Mensajes del chat"
        >
          {messages.length === 0 && !currentConversation && (
            <div className="flex flex-col items-center justify-center h-full text-center" role="status">
              <Bot className="h-16 w-16 text-muted-foreground mb-4" aria-hidden="true" />
              <h3 className="text-lg font-medium text-foreground mb-2">¡Bienvenido al Grok Chatbot!</h3>
              <p className="text-muted-foreground max-w-md">
                Crea una nueva conversación para comenzar a chatear con Grok, el AI de xAI.
                <br />
                <span className="text-xs mt-2 block">
                  Presiona Ctrl+K para enfocar el campo de entrada
                </span>
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              role="article"
              aria-label={`Mensaje de ${message.role === 'user' ? 'usuario' : 'asistente'}`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                    <Bot className="h-4 w-4 text-accent-foreground" aria-hidden="true" />
                  </div>
                </div>
              )}

              <div
                className={`max-w-lg rounded-lg px-4 py-2 ${message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-foreground'
                  }`}
              >
                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mb-2 space-y-1" aria-label="Archivos adjuntos">
                    {message.attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded" role="img" aria-label={`Archivo adjunto: ${attachment.name}`}>
                        <Paperclip className="h-3 w-3" aria-hidden="true" />
                        <span className="text-xs">{attachment.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message content */}
                <div className="text-sm">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{ code: CodeBlock }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                <time className="text-xs text-muted-foreground mt-1" dateTime={message.timestamp}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </time>
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing effect */}
          {isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4 text-accent-foreground" />
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg px-4 py-2 max-w-lg">
                <div className="text-sm">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{ code: CodeBlock }}
                  >
                    {typingText}
                  </ReactMarkdown>
                </div>
                <div className="flex space-x-1 mt-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          {isLoading && !isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4 text-accent-foreground" />
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="bg-muted border-t border-border p-2">
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <div key={index} className="flex items-center gap-2 bg-card px-2 py-1 rounded border border-border">
                  <Paperclip className="h-3 w-3" />
                  <span className="text-xs">{attachment.name} ({(attachment.size / 1024 / 1024).toFixed(2)} MB)</span>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="bg-card border-t border-border p-4">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} role="form" aria-label="Enviar mensaje">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu mensaje..."
                disabled={isLoading || !currentConversation}
                className="flex-1 px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                aria-label="Campo de entrada de mensaje"
                aria-describedby="input-help"
                autoComplete="off"
              />

              {/* File attachment button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || !currentConversation}
                className="px-3 py-2 border border-input rounded-lg hover:bg-accent disabled:opacity-50 transition-colors"
                aria-label="Adjuntar archivos"
                title="Adjuntar archivos (máx. 10MB)"
              >
                <Paperclip className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="submit"
                onClick={sendMessage}
                disabled={!input.trim() && attachments.length === 0 || isLoading || !currentConversation}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Enviar mensaje"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>

          <div id="input-help" className="sr-only">
            Presiona Enter para enviar, Shift+Enter para nueva línea. Ctrl+K para enfocar este campo.
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,text/*,.pdf,.doc,.docx"
            aria-label="Seleccionar archivos para adjuntar"
          />
        </div>
      </div>
    </div>
  );
}