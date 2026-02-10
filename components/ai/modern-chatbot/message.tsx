'use client';

import React from 'react';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import type { Message as MessageType } from './types';
import { MessageActions } from './message-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSession } from 'next-auth/react';

import { AnalysisBlock } from './blocks/analysis-block';
import { PlanBlock } from './blocks/plan-block';
import { ConfirmationBlock } from './blocks/confirmation-block';
import { ResultBlock } from './blocks/result-block';
import { useChatbot } from './context';

interface MessageProps {
    message: MessageType;
    onCopy: () => void;
    onRetry: () => void;
    onLike: () => void;
    onDislike: () => void;
}

const MarkdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
            <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="rounded-lg !mt-2 !mb-2"
                {...props}
            >
                {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
        ) : (
            <code className="px-1.5 py-0.5 bg-secondary rounded text-primary" {...props}>
                {children}
            </code>
        );
    },
    p({ children }: any) {
        return <p className="mb-4 last:mb-0 leading-7 text-foreground">{children}</p>;
    },
    ul({ children }: any) {
        return <ul className="list-disc list-inside mb-4 space-y-1 text-foreground">{children}</ul>;
    },
    ol({ children }: any) {
        return <ol className="list-decimal list-inside mb-4 space-y-1 text-foreground">{children}</ol>;
    },
    h1({ children }: any) {
        return <h1 className="text-2xl font-bold mb-4 mt-6 text-foreground">{children}</h1>;
    },
    h2({ children }: any) {
        return <h2 className="text-xl font-bold mb-3 mt-5 text-foreground">{children}</h2>;
    },
    h3({ children }: any) {
        return <h3 className="text-lg font-bold mb-2 mt-4 text-foreground">{children}</h3>;
    },
    blockquote({ children }: any) {
        return (
            <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
                {children}
            </blockquote>
        );
    },
    table({ children }: any) {
        return (
            <div className="overflow-x-auto my-4">
                <table className="min-w-full divide-y divide-border">{children}</table>
            </div>
        );
    },
    th({ children }: any) {
        return (
            <th className="px-4 py-2 bg-secondary text-left text-xs font-medium text-secondary-foreground uppercase tracking-wider">
                {children}
            </th>
        );
    },
    td({ children }: any) {
        return <td className="px-4 py-2 text-sm text-foreground border-t border-border">{children}</td>;
    },
    a({ href, children }: any) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline"
            >
                {children}
            </a>
        );
    }
};

export function Message({ message, onCopy, onRetry, onLike, onDislike }: MessageProps) {
    const isUser = message.role === 'user';
    const { confirmAction, cancelAction, editMessage } = useChatbot();
    const { data: session } = useSession();

    const [isEditing, setIsEditing] = React.useState(false);
    const [editContent, setEditContent] = React.useState(message.content);

    const handleSaveEdit = async () => {
        if (editContent.trim() !== message.content) {
            await editMessage(message.id, editContent);
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditContent(message.content);
        setIsEditing(false);
    };

    return (
        <div className={`group flex gap-4 px-6 py-6 transition-all duration-300 ${isUser
            ? 'bg-transparent hover:bg-white/5'
            : 'bg-white/[0.02] border-y border-white/5 hover:bg-white/[0.04]'
            }`}>
            {/* Avatar */}
            <div className="flex-shrink-0">
                {isUser ? (
                    <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || 'User'} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground rounded-lg">
                            <User className="w-5 h-5" />
                        </AvatarFallback>
                    </Avatar>
                ) : (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary">
                        <Bot className="w-5 h-5 text-primary-foreground" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-foreground">
                        {isUser ? (session?.user?.name || 'User') : 'Internal Assistant'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                </div>

                {/* Attachments Preview */}
                {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-4">
                        {message.attachments.map((attachment) => {
                            const isImage = attachment.type.startsWith('image/');
                            return (
                                <div key={attachment.id} className="relative group/attachment max-w-[300px]">
                                    {isImage ? (
                                        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 shadow-xl transition-transform hover:scale-[1.02]">
                                            <img
                                                src={attachment.url}
                                                alt={attachment.name}
                                                className="max-h-[300px] w-auto object-contain"
                                            />
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover/attachment:opacity-100 transition-opacity">
                                                <p className="text-xs text-white truncate">{attachment.name}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                                            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                                <Bot className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{attachment.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {(attachment.size ? (attachment.size / 1024).toFixed(1) : 0)} KB
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}


                {/* Structured Blocks */}
                {message.blocks && message.blocks.length > 0 ? (
                    <div className="space-y-2">
                        {message.blocks.map((block) => {
                            if (block.isVisible === false) return null;

                            switch (block.type) {
                                case 'analysis':
                                    return <AnalysisBlock key={block.id} content={block.content} />;
                                case 'plan':
                                    return <PlanBlock key={block.id} items={block.content} />;
                                case 'confirmation':
                                    return (
                                        <ConfirmationBlock
                                            key={block.id}
                                            status={block.status as any}
                                            action={block.content}
                                            onConfirm={() => confirmAction(message.id, block.id)}
                                            onCancel={() => cancelAction(message.id, block.id)}
                                        />
                                    );
                                case 'result':
                                    return (
                                        <ResultBlock
                                            key={block.id}
                                            success={block.status === 'success'}
                                            output={block.content}
                                            metadata={block.metadata}
                                        />
                                    );
                                default:
                                    return null;
                            }
                        })}
                    </div>
                ) : (
                    // Regular Text Content or Edit Mode
                    isEditing ? (
                        <div className="mt-2">
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full bg-secondary/50 border border-input rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                                rows={Math.max(3, editContent.split('\n').length)}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                >
                                    Guardar y enviar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={MarkdownComponents}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    )
                )}

                {/* Suggested Followups */}
                {message.suggestedFollowups && message.suggestedFollowups.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {message.suggestedFollowups.map((prompt, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    const event = new CustomEvent('chat-followup', { detail: prompt });
                                    window.dispatchEvent(event);
                                }}
                                className="text-xs bg-secondary/50 hover:bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full transition-colors border border-white/5"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                )}

                {/* Actions */}
                <div className="mt-2">
                    <MessageActions
                        message={message}
                        onCopy={onCopy}
                        onRetry={onRetry}
                        onLike={onLike}
                        onDislike={onDislike}
                        onEdit={() => setIsEditing(true)}
                    />
                </div>
            </div>
        </div>
    );
}
