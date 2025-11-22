'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConversationMessage } from '@/types/ai';
import { Send, Bot, User, LogIn } from 'lucide-react';
import { kiloAPI } from '@/lib/kilo';

export function Chatbot() {
   const { data: session, status } = useSession();
   const [messages, setMessages] = useState<ConversationMessage[]>([]);
   const [input, setInput] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const [conversationId, setConversationId] = useState<string | null>(null);
   const [isAuthenticated, setIsAuthenticated] = useState(false);
   const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Check authentication and load conversations on mount
  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user?.id) {
      setIsAuthenticated(false);
      return;
    }

    // Check if user has kiloUserId
    const checkKiloAuth = async () => {
      try {
        const auth = await kiloAPI.checkAuth();
        setIsAuthenticated(auth.hasAuth);
      } catch (error) {
        console.error('Failed to check Kilo auth:', error);
        setIsAuthenticated(false);
      }
    };

    checkKiloAuth();
  }, [session, status]);

  // Load conversations when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadConversations = async () => {
      try {
        const response = await fetch('/api/conversations');
        if (response.ok) {
          const conversations = await response.json();
          if (conversations.length > 0) {
            // Use the most recent conversation
            const latestConversation = conversations[0];
            setConversationId(latestConversation.id);
            // Convert messages to ConversationMessage format
            const conversationMessages: ConversationMessage[] = latestConversation.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.createdAt
            }));
            setMessages(conversationMessages);
          }
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    };

    loadConversations();
  }, [isAuthenticated]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !isAuthenticated) return;

    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId: conversationId
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Set conversationId if new conversation was created
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      // Add AI response to messages
      const aiMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (status === 'loading') {
    return (
      <Card className="flex flex-col h-[600px] w-full max-w-2xl mx-auto">
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
            <p>Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!session?.user?.id) {
    return (
      <Card className="flex flex-col h-[600px] w-full max-w-2xl mx-auto">
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Please sign in to use the AI assistant.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="flex flex-col h-[600px] w-full max-w-2xl mx-auto">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">Connect with Kilo to access AI features.</p>
            <Button onClick={() => kiloAPI.initiateAuth()}>
              <LogIn className="h-4 w-4 mr-2" />
              Authenticate with Kilo
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[600px] w-full max-w-2xl mx-auto">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Assistant
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-6">
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Hi! I'm your AI assistant. I can help you manage your tasks, habits, and more.</p>
                <p className="text-sm mt-2">Try saying "Create a task: Finish the report" or "Show my pending tasks"</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0">
                    <Bot className="h-8 w-8 p-1 bg-primary/10 rounded-full" />
                  </div>
                )}

                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0">
                    <User className="h-8 w-8 p-1 bg-secondary rounded-full" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0">
                  <Bot className="h-8 w-8 p-1 bg-primary/10 rounded-full" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}