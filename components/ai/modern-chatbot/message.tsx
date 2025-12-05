'use client';

import React from 'react';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import type { Message as MessageType } from './types';
import { MessageActions } from './message-actions';

interface MessageProps {
    message: MessageType;
    onCopy: () => void;
    onRetry: () => void;
    onLike: () => void;
    onDislike: () => void;
}

export function Message({ message, onCopy, onRetry, onLike, onDislike }: MessageProps) {
    const isUser = message.role === 'user';

    return (
        <div className={`group flex gap-4 px-6 py-6 hover:bg-accent/30 transition-colors ${isUser ? '' : 'bg-accent/10'
            }`}>
            {/* Avatar */}
            <div className="flex-shrink-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isUser ? 'bg-secondary' : 'bg-primary'
                    }`}>
                    {isUser ? (
                        <User className="w-5 h-5 text-secondary-foreground" />
                    ) : (
                        <Bot className="w-5 h-5 text-primary-foreground" />
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-foreground">
                        {isUser ? 'Tú' : 'AI'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                    {message.model && (
                        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-secondary rounded">
                            {message.model}
                        </span>
                    )}
                </div>

                {/* Message content with markdown */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            code({ node, inline, className, children, ...props }) {
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
                            p({ children }) {
                                return <p className="mb-4 last:mb-0 leading-7 text-foreground">{children}</p>;
                            },
                            ul({ children }) {
                                return <ul className="list-disc list-inside mb-4 space-y-1 text-foreground">{children}</ul>;
                            },
                            ol({ children }) {
                                return <ol className="list-decimal list-inside mb-4 space-y-1 text-foreground">{children}</ol>;
                            },
                            h1({ children }) {
                                return <h1 className="text-2xl font-bold mb-4 mt-6 text-foreground">{children}</h1>;
                            },
                            h2({ children }) {
                                return <h2 className="text-xl font-bold mb-3 mt-5 text-foreground">{children}</h2>;
                            },
                            h3({ children }) {
                                return <h3 className="text-lg font-bold mb-2 mt-4 text-foreground">{children}</h3>;
                            },
                            blockquote({ children }) {
                                return (
                                    <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
                                        {children}
                                    </blockquote>
                                );
                            },
                            table({ children }) {
                                return (
                                    <div className="overflow-x-auto my-4">
                                        <table className="min-w-full divide-y divide-border">{children}</table>
                                    </div>
                                );
                            },
                            th({ children }) {
                                return (
                                    <th className="px-4 py-2 bg-secondary text-left text-xs font-medium text-secondary-foreground uppercase tracking-wider">
                                        {children}
                                    </th>
                                );
                            },
                            td({ children }) {
                                return <td className="px-4 py-2 text-sm text-foreground border-t border-border">{children}</td>;
                            },
                            a({ href, children }) {
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
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                </div>

                {/* Actions */}
                <div className="mt-3">
                    <MessageActions
                        message={message}
                        onCopy={onCopy}
                        onRetry={onRetry}
                        onLike={onLike}
                        onDislike={onDislike}
                    />
                </div>
            </div>
        </div>
    );
}
