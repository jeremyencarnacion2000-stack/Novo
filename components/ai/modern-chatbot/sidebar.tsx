'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Search, Plus, MessageSquare, Trash2, MoreHorizontal, Edit, Square } from 'lucide-react';
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

    // Group conversations by date intervals (Today, Yesterday, 3 days ago, 7 days ago, Last 30 days, Older)
    const groupConversationsByDate = (convs: typeof conversations) => {
        const groups: { [key: string]: typeof conversations } = {
            'Today': [],
            'Yesterday': [],
            '3 days ago': [],
            '7 days ago': [],
            'Last 30 days': [],
            'Older': []
        };

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        convs.forEach(conv => {
            const date = new Date(conv.createdAt || conv.updatedAt || new Date()).getTime();
            const diffDays = Math.floor((startOfToday - date) / oneDayMs);

            if (date >= startOfToday) {
                groups['Today'].push(conv);
            } else if (diffDays === 0) {
                groups['Yesterday'].push(conv);
            } else if (diffDays > 0 && diffDays <= 2) {
                groups['3 days ago'].push(conv);
            } else if (diffDays > 2 && diffDays <= 6) {
                groups['7 days ago'].push(conv);
            } else if (diffDays > 6 && diffDays <= 29) {
                groups['Last 30 days'].push(conv);
            } else {
                groups['Older'].push(conv);
            }
        });

        return Object.entries(groups).filter(([_, items]) => items.length > 0);
    };

    const groupedConversations = groupConversationsByDate(filteredConversations);

    const handleClearAll = () => {
        if (confirm('¿Estás seguro de que deseas eliminar todo el historial de conversaciones? Esta acción es irreversible.')) {
            conversations.forEach(c => deleteConversation(c.id));
        }
    };

    return (
        <div
            className={`relative h-full bg-[#030305]/95 border-r border-white/5 transition-all duration-500 ease-in-out flex flex-col backdrop-blur-3xl z-40 overflow-hidden ${sidebarCollapsed ? 'w-16' : 'w-full md:w-72 lg:w-80'
                }`}
        >
            {/* Header */}
            <div className={`flex items-center p-5 border-b border-white/5 flex-shrink-0 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                {!sidebarCollapsed && (
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary-glow)]" />
                        <h2 className="text-[10px] font-bold text-white/40 tracking-[0.25em] uppercase">Historial</h2>
                    </div>
                )}
                <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-all text-white/40 hover:text-white"
                    aria-label={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
                >
                    {sidebarCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <ChevronLeft className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Actions Area */}
            <div className={`p-4 space-y-3 flex-shrink-0 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
                {/* BuildHub Style Header Actions */}
                {!sidebarCollapsed ? (
                    <div className="flex items-center justify-between gap-2">
                        {/* New Chat Button */}
                        <button
                            onClick={createConversation}
                            className="flex items-center justify-center gap-2 flex-1 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl transition-all duration-300 font-medium text-xs shadow-lg shadow-primary/5 group"
                            title="Nueva conversación"
                        >
                            <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
                            <span>Nuevo Chat</span>
                        </button>

                        {/* Trash clear all button */}
                        <button
                            onClick={handleClearAll}
                            className="p-2 bg-white/[0.02] hover:bg-red-500/15 border border-white/5 hover:border-red-500/30 text-white/40 hover:text-red-400 rounded-xl transition-all duration-300"
                            title="Limpiar historial"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <button
                            onClick={createConversation}
                            className="p-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl transition-all duration-300"
                            title="Nuevo Chat"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="p-3 bg-white/[0.02] hover:bg-red-500/15 border border-white/5 hover:border-red-500/30 text-white/40 hover:text-red-400 rounded-xl transition-all"
                            title="Limpiar Historial"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Search */}
                {!sidebarCollapsed && (
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar chats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/5 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none focus:border-primary/30 transition-all font-sans"
                        />
                    </div>
                )}
            </div>

            {/* Conversations List */}
            <div className={`flex-1 overflow-y-auto min-h-0 py-2 ${sidebarCollapsed ? 'scrollbar-hide px-2' : 'custom-scrollbar px-3'}`}>
                <div className="space-y-4">
                {groupedConversations.length === 0 ? (
                    !sidebarCollapsed && (
                        <div className="text-center py-12 text-white/10 text-xs italic">
                            {searchQuery ? 'Sin resultados' : 'Sin chats recientes'}
                        </div>
                    )
                ) : (
                    groupedConversations.map(([groupName, items]) => (
                        <div key={groupName} className="space-y-1.5 animate-in fade-in duration-300">
                            {!sidebarCollapsed && (
                                <div className="text-[9px] font-bold tracking-[0.15em] text-white/20 uppercase pl-2 mb-1">
                                    {groupName}
                                </div>
                            )}

                            {items.map((conv) => (
                                <div
                                    key={conv.id}
                                    data-conversation-item
                                    className={`group relative flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-300 border min-w-0 ${sidebarCollapsed ? 'p-3 justify-center' : 'px-3 py-2.5'
                                        } ${currentConversationId === conv.id
                                            ? 'bg-primary/[0.04] text-white border-primary/20 shadow-[0_0_20px_rgba(var(--primary-rgb),0.06)]'
                                            : 'text-white/40 hover:bg-white/[0.02] hover:text-white/80 border-transparent'
                                        }`}
                                    onClick={() => setCurrentConversationId(conv.id)}
                                    title={sidebarCollapsed ? conv.title : undefined}
                                >
                                    <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${currentConversationId === conv.id ? 'text-primary' : 'opacity-30 group-hover:opacity-60'}`} />
                                    {!sidebarCollapsed && (
                                        <>
                                            <span className="flex-1 text-xs truncate font-medium tracking-wide">{conv.title}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('¿Eliminar esta conversación?')) {
                                                        deleteConversation(conv.id);
                                                    }
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all"
                                                aria-label="Eliminar"
                                            >
                                                <MoreHorizontal className="w-3.5 h-3.5 text-white/30 hover:text-red-400" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))
                )}
                </div>
            </div>
        </div>
    );
}
