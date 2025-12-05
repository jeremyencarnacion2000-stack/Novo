'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Search, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { useChatbot } from './context';

export function Sidebar() {
    const {
        conversations,
        currentConversationId,
        setCurrentConversationId,
        createConversation,
        deleteConversation,
        sidebarCollapsed,
        setSidebarCollapsed
    } = useChatbot();

    const [searchQuery, setSearchQuery] = React.useState('');

    const filteredConversations = conversations.filter(conv =>
        conv.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div
            className={`relative h-full bg-card border-r border-border transition-all duration-300 flex flex-col ${sidebarCollapsed ? 'w-0 lg:w-16' : 'w-64 lg:w-72'
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
                {!sidebarCollapsed && (
                    <h2 className="text-lg font-semibold text-foreground">Conversaciones</h2>
                )}
                <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="p-2 hover:bg-accent rounded-lg transition-colors"
                    aria-label={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
                >
                    {sidebarCollapsed ? (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    ) : (
                        <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                    )}
                </button>
            </div>

            {!sidebarCollapsed && (
                <>
                    {/* Search */}
                    <div className="p-3 flex-shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar conversaciones..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </div>

                    {/* New Conversation Button */}
                    <div className="px-3 pb-3 flex-shrink-0">
                        <button
                            onClick={createConversation}
                            className="w-full flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm font-medium">Nueva conversación</span>
                        </button>
                    </div>

                    {/* Conversations List - NOW WITH INDEPENDENT SCROLL */}
                    <div className="flex-1 overflow-y-auto px-3 space-y-1 min-h-0">
                        {filteredConversations.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                {searchQuery ? 'No se encontraron conversaciones' : 'No hay conversaciones'}
                            </div>
                        ) : (
                            filteredConversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${currentConversationId === conv.id
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                                        }`}
                                    onClick={() => setCurrentConversationId(conv.id)}
                                >
                                    <MessageSquare className="w-4 h-4 flex-shrink-0" />
                                    <span className="flex-1 text-sm truncate">{conv.title}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('¿Eliminar esta conversación?')) {
                                                deleteConversation(conv.id);
                                            }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-opacity"
                                        aria-label="Eliminar conversación"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
