'use client';

import React from 'react';
import { Copy, RotateCcw, ThumbsDown, ThumbsUp, Pencil } from 'lucide-react';
import type { Message } from './types';

interface MessageActionsProps {
    message: Message;
    onCopy: () => void;
    onRetry: () => void;
    onLike: () => void;
    onDislike: () => void;
    onEdit?: () => void;
}

export function MessageActions({ message, onCopy, onRetry, onLike, onDislike, onEdit }: MessageActionsProps) {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                title="Copiar"
            >
                <Copy className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
            </button>

            {message.role === 'assistant' && (
                <>
                    <button
                        onClick={onRetry}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        title="Regenerar"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
                    </button>

                    <button
                        onClick={onLike}
                        className={`p-1.5 hover:bg-white/10 rounded transition-colors ${message.liked ? 'bg-white/10' : ''
                            }`}
                        title="Me gusta"
                    >
                        <ThumbsUp className={`w-3.5 h-3.5 ${message.liked ? 'text-green-400' : 'text-white/40 hover:text-white/70'}`} />
                    </button>

                    <button
                        onClick={onDislike}
                        className={`p-1.5 hover:bg-white/10 rounded transition-colors ${message.disliked ? 'bg-white/10' : ''
                            }`}
                        title="No me gusta"
                    >
                        <ThumbsDown className={`w-3.5 h-3.5 ${message.disliked ? 'text-red-400' : 'text-white/40 hover:text-white/70'}`} />
                    </button>
                </>
            )}

            {message.role === 'user' && onEdit && (
                <button
                    onClick={onEdit}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    title="Editar"
                >
                    <Pencil className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
                </button>
            )}

            {copied && (
                <span className="text-xs text-green-400 ml-1">Copiado!</span>
            )}
        </div>
    );
}
