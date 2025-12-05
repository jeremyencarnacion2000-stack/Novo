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
            className={`relative h-full bg-zinc-900 border-r border-zinc-800 transition-all duration-300 flex flex-col ${sidebarCollapsed ? 'w-0 lg:w-16' : 'w-64 lg:w-72'
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                {!sidebarCollapsed && (
                    <h2 className="text-lg font-semibold text-white">Conversaciones</h2>
                )}
                <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                    aria-label={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
                >
                    {sidebarCollapsed ? (
                        <ChevronRight className="w-5 h-5 text-zinc-400" />
                    ) : (
                        <ChevronLeft className="w-5 h-5 text-zinc-400" />
                    )}
                </button>
            </div>

            {!sidebarCollapsed && (
                <>
                    {/* Search */}
                    <div className="p-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Buscar conversaciones..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                            />
                        </div>
                    </div>

                    {/* New Conversation Button */}
                    <div className="px-3 pb-3">
                        <button
                            onClick={createConversation}
                            className="w-full flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm font-medium">Nueva conversación</span>
                        </button>
                    </div>

                    {/* Conversations List */}
                    <div className="flex-1 overflow-y-auto px-3 space-y-1">
                        {filteredConversations.length === 0 ? (
                            <div className="text-center py-8 text-zinc-500 text-sm">
                                {searchQuery ? 'No se encontraron conversaciones' : 'No hay conversaciones'}
                            </div>
                        ) : (
                            filteredConversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${currentConversationId === conv.id
                                            ? 'bg-zinc-800 text-white'
                                            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
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
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity"
                                        aria-label="Eliminar conversación"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
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
