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



export function Message({ message, onCopy, onRetry, onLike, onDislike }: MessageProps) {
    const isUser = message.role === 'user';
    const { confirmAction, cancelAction } = useChatbot();
    const { data: session } = useSession();

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
                                            metadata={block.content?.metadata}
                                        />
                                    );
                                case 'text':
                                default:
                                    return (
                                        <div key={block.id} className="prose prose-sm dark:prose-invert max-w-none">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {block.content}
                                            </ReactMarkdown>
                                        </div>
                                    );
                            }
                        })}
                    </div>
                ) : (
                    /* Fallback to legacy markdown content */
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
                            {(() => {
                                // If it looks like a JSON response from the assistant, don't show the raw text
                                if (!isUser && (message.content.trim().startsWith('{') || message.content.includes('```json'))) {
                                    return (
                                        <div className="flex items-center gap-2 text-indigo-400/70 italic text-sm py-2">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                            </span>
                                            Procesando respuesta estructurada...
                                        </div>
                                    );
                                }
                                return message.content;
                            })()}
                        </ReactMarkdown>
                    </div>
                )}

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
