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
            className={`relative h-full bg-white/[0.02] backdrop-blur-xl border-r border-white/5 transition-all duration-500 ease-in-out flex flex-col ${sidebarCollapsed ? 'w-16' : 'w-72 lg:w-80'
                }`}
        >
            {/* Header */}
            <div className={`flex items-center p-4 border-b border-white/5 flex-shrink-0 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                {!sidebarCollapsed && (
                    <h2 className="text-sm font-bold text-white/90 tracking-widest uppercase opacity-80">Conversaciones</h2>
                )}
                <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="p-2 hover:bg-white/5 rounded-xl transition-all duration-300 text-white/50 hover:text-white"
                    aria-label={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
                >
                    {sidebarCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                    ) : (
                        <ChevronLeft className="w-5 h-5" />
                    )}
                </button>
            </div>

            {/* Actions Area */}
            <div className={`p-3 space-y-2 flex-shrink-0 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
                {/* New Conversation Button */}
                <button
                    onClick={createConversation}
                    className={`flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl transition-all duration-300 group shadow-lg shadow-indigo-500/5 ${sidebarCollapsed ? 'p-3 justify-center' : 'w-full px-4 py-2.5'
                        }`}
                    title="Nueva conversación"
                >
                    <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                    {!sidebarCollapsed && <span className="text-sm font-medium">Nueva conversación</span>}
                </button>

                {/* Search - Only in expanded or as icon in collapsed */}
                {sidebarCollapsed ? (
                    <button className="p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                        <Search className="w-4 h-4" />
                    </button>
                ) : (
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-indigo-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                        />
                    </div>
                )}
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto px-2 space-y-1 min-h-0 custom-scrollbar py-2">
                {filteredConversations.length === 0 ? (
                    !sidebarCollapsed && (
                        <div className="text-center py-8 text-white/20 text-xs font-medium italic">
                            {searchQuery ? 'Sin resultados' : 'Sin historial'}
                        </div>
                    )
                ) : (
                    filteredConversations.map((conv) => (
                        <div
                            key={conv.id}
                            className={`group relative flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-300 ${sidebarCollapsed ? 'p-3 justify-center' : 'px-3 py-2.5'
                                } ${currentConversationId === conv.id
                                    ? 'bg-white/10 text-white shadow-sm border border-white/5'
                                    : 'text-white/40 hover:bg-white/[0.04] hover:text-white/80'
                                }`}
                            onClick={() => setCurrentConversationId(conv.id)}
                            title={sidebarCollapsed ? conv.title : undefined}
                        >
                            <MessageSquare className={`w-4 h-4 flex-shrink-0 ${currentConversationId === conv.id ? 'text-indigo-400' : 'opacity-50'}`} />
                            {!sidebarCollapsed && (
                                <>
                                    <span className="flex-1 text-sm truncate font-medium">{conv.title}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('¿Eliminar esta conversación?')) {
                                                deleteConversation(conv.id);
                                            }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all"
                                        aria-label="Eliminar conversación"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
