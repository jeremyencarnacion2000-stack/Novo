"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, X, MessageSquare, Code, Bug, FileText, Play, Settings, ChevronUp, ChevronDown, Zap, Bot, Loader2, AlertTriangle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { detectIntent, createTask, createProject, createChecklist, createHabit } from '@/lib/ai-commands';
import { useRouter } from 'next/navigation';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  description: string;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  isUser: boolean;
}

export default function FloatingChatbot() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [currentContext, setCurrentContext] = useState<string>('');
  const [showConfirmation, setShowConfirmation] = useState<{ action: string; message: string; onConfirm: () => void } | null>(null);
  const [settings, setSettings] = useState({
    theme: 'auto',
    size: 'medium',
    autoHide: false,
    position: 'bottom-right'
  });

  const { theme } = useTheme();
  const router = useRouter();
  const bubbleRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Inicializar posición y cargar estado persistido
  useEffect(() => {
    const savedPosition = localStorage.getItem('floating-chatbot-position');
    const savedMinimized = localStorage.getItem('floating-chatbot-minimized');
    const savedMessages = localStorage.getItem('floating-chatbot-messages');
    const savedSettings = localStorage.getItem('floating-chatbot-settings');

    if (savedPosition) {
      setPosition(JSON.parse(savedPosition));
    } else {
      // Posición por defecto
      setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
    }
    if (savedMinimized) {
      setIsMinimized(JSON.parse(savedMinimized));
    }
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('floating-chatbot-position', JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    localStorage.setItem('floating-chatbot-minimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  useEffect(() => {
    localStorage.setItem('floating-chatbot-messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('floating-chatbot-settings', JSON.stringify(settings));
  }, [settings]);

  // Detectar contexto actual
  useEffect(() => {
    const updateContext = () => {
      const path = window.location.pathname;
      const pageName = path.split('/').pop() || 'home';
      setCurrentContext(`Página actual: ${pageName}`);
    };

    updateContext();
    window.addEventListener('popstate', updateContext);
    return () => window.removeEventListener('popstate', updateContext);
  }, []);

  // Funciones de drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!bubbleRef.current) return;

    setIsDragging(true);
    const rect = bubbleRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Mantener dentro de los límites de la pantalla
    const maxX = window.innerWidth - 60;
    const maxY = window.innerHeight - 60;

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Ejecutar comandos
  const executeCommand = async (intent: string, data: Record<string, any>): Promise<string> => {
    try {
      switch (intent) {
        case 'create_task':
          const taskResult = await createTask(data as { title: string; projectName?: string; dueDate?: string; priority?: 'low' | 'medium' | 'high' });
          return taskResult.success ? `✅ Tarea "${data.title}" creada.` : `❌ Error: ${taskResult.error}`;
        case 'add_project':
          const projectResult = await createProject(data.projectName);
          return projectResult.success ? `✅ Proyecto "${data.projectName}" creado.` : `❌ Error: ${projectResult.error}`;
        case 'create_checklist':
          const checklistResult = await createChecklist(data.items);
          return checklistResult.success ? `✅ Checklist creada.` : `❌ Error: ${checklistResult.error}`;
        case 'create_habit':
          const habitResult = await createHabit(data.habitName);
          return habitResult.success ? `✅ Hábito "${data.habitName}" creado.` : `❌ Error: ${habitResult.error}`;
        default:
          return 'Comando no reconocido.';
      }
    } catch (error) {
      return 'Error interno.';
    }
  };

  // Acciones rápidas
  const quickActions: QuickAction[] = [
    {
      id: 'generate_code',
      label: 'Generar Código',
      icon: <Code size={16} />,
      action: () => handleQuickAction('Genera código para una función de suma en JavaScript'),
      description: 'Crear snippets de código'
    },
    {
      id: 'validate_errors',
      label: 'Validar Errores',
      icon: <Bug size={16} />,
      action: () => handleQuickAction('Revisa si hay errores en el código actual'),
      description: 'Analizar y corregir bugs'
    },
    {
      id: 'explain_file',
      label: 'Explicar Archivo',
      icon: <FileText size={16} />,
      action: () => handleQuickAction(`Explica qué hace este archivo: ${currentContext}`),
      description: 'Entender código existente'
    },
    {
      id: 'run_lint',
      label: 'Ejecutar Lint',
      icon: <Play size={16} />,
      action: () => handleQuickAction('Ejecuta linting en el proyecto'),
      description: 'Verificar calidad del código'
    },
    {
      id: 'clear_history',
      label: 'Limpiar Historial',
      icon: <X size={16} />,
      action: () => requestConfirmation('Limpiar Historial', '¿Estás seguro de que quieres eliminar todas las conversaciones?', clearHistory),
      description: 'Eliminar historial de chat'
    },
    {
      id: 'settings',
      label: 'Configuración',
      icon: <Settings size={16} />,
      action: () => requestConfirmation('Configuración', 'Funcionalidad de configuración próximamente', () => {}),
      description: 'Personalizar el widget'
    },
    {
      id: 'open_full_chat',
      label: 'Chat Completo',
      icon: <MessageSquare size={16} />,
      action: () => router.push('/ai'),
      description: 'Abrir chatbot principal'
    }
  ];

  const handleQuickAction = async (message: string) => {
    setInput(message);
    await handleSubmit(message);
  };

  const requestConfirmation = (action: string, message: string, onConfirm: () => void) => {
    setShowConfirmation({ action, message, onConfirm });
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem('floating-chatbot-messages');
  };

  const resetSettings = () => {
    setSettings({
      theme: 'auto',
      size: 'medium',
      autoHide: false,
      position: 'bottom-right'
    });
    setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
    localStorage.removeItem('floating-chatbot-settings');
    localStorage.removeItem('floating-chatbot-position');
  };

  const handleSubmit = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: text,
      timestamp: new Date().toISOString(),
      isUser: true
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Detectar intención
      const intentData = detectIntent(text);

      if (intentData.intent !== 'general_chat') {
        // Comando directo
        const response = await executeCommand(intentData.intent, intentData.data);
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response,
          timestamp: new Date().toISOString(),
          isUser: false
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        // Delegar al chatbot principal
        const response = await fetch('/api/ai/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, context: currentContext })
        });

        if (response.ok) {
          const data = await response.json();
          const botMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: data.response || 'Respuesta del chatbot principal',
            timestamp: new Date().toISOString(),
            isUser: false
          };
          setMessages(prev => [...prev, botMessage]);
        } else {
          // Fallback simple
          const botMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: 'Lo siento, no pude procesar tu solicitud. ¿Quieres abrir el chat completo?',
            timestamp: new Date().toISOString(),
            isUser: false
          };
          setMessages(prev => [...prev, botMessage]);
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Error de conexión. Intenta más tarde.',
        timestamp: new Date().toISOString(),
        isUser: false
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (isMinimized) {
    return (
      <div
        ref={bubbleRef}
        onMouseDown={handleMouseDown}
        className="fixed z-50 w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 dark:from-purple-600 dark:to-blue-600 dark:hover:from-purple-700 dark:hover:to-blue-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center cursor-move group"
        style={{ left: position.x, top: position.y }}
        onClick={() => setIsMinimized(false)}
      >
        <Sparkles size={20} className="text-white group-hover:scale-110 transition-transform" />
      </div>
    );
  }

  return (
    <>
      {/* Burbuja flotante */}
      <div
        ref={bubbleRef}
        onMouseDown={handleMouseDown}
        className={`fixed z-50 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 cursor-move group ${
          isExpanded
            ? `w-${settings.size === 'small' ? '10' : settings.size === 'large' ? '14' : '12'} h-${settings.size === 'small' ? '10' : settings.size === 'large' ? '14' : '12'} bg-gradient-to-r from-purple-500 to-blue-500`
            : `w-${settings.size === 'small' ? '12' : settings.size === 'large' ? '16' : '14'} h-${settings.size === 'small' ? '12' : settings.size === 'large' ? '16' : '14'} bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600`
        }`}
        style={{ left: position.x, top: position.y }}
        onClick={() => !isDragging && setIsExpanded(!isExpanded)}
      >
        <div className="w-full h-full flex items-center justify-center">
          {isExpanded ? (
            <X size={settings.size === 'small' ? 16 : settings.size === 'large' ? 24 : 20} className="text-white group-hover:scale-110 transition-transform" />
          ) : (
            <Sparkles size={settings.size === 'small' ? 20 : settings.size === 'large' ? 28 : 24} className="text-white group-hover:scale-110 transition-transform" />
          )}
        </div>
      </div>

      {/* Panel expandido */}
      {isExpanded && (
        <div
          ref={panelRef}
          className="fixed z-40 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          style={{
            left: Math.max(10, Math.min(position.x - 150, window.innerWidth - 320)),
            top: Math.max(10, Math.min(position.y - 300, window.innerHeight - 400)),
            width: 300,
            height: 350
          }}
        >
          {/* Header */}
          <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot size={18} />
              <span className="font-semibold text-sm">Mini AI</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <Zap size={14} />
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* Contexto */}
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
            {currentContext}
          </div>

          {/* Mensajes */}
          <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-32">
            {messages.slice(-3).map((msg) => (
              <div key={msg.id} className={`text-xs ${msg.isUser ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block px-2 py-1 rounded-lg max-w-full ${
                  msg.isUser
                    ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}>
                  {msg.content.length > 50 ? `${msg.content.substring(0, 50)}...` : msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-left">
                <div className="inline-block px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700">
                  <Loader2 size={12} className="animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          {showQuickActions && (
            <div className="px-3 pb-2 space-y-1">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={action.action}
                  className="w-full text-left p-2 text-xs bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center space-x-2"
                  title={action.description}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Pregunta rápida..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSubmit()}
                disabled={isLoading || !input.trim()}
                className="px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {showConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center mb-4">
              <AlertTriangle className="text-yellow-500 mr-3" size={24} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {showConfirmation.action}
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {showConfirmation.message}
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmation(null)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  showConfirmation.onConfirm();
                  setShowConfirmation(null);
                }}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}