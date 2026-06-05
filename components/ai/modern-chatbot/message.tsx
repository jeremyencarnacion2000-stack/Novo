'use client';

import React from 'react';
import { Bot, User, Copy, Check, Download, Eye, EyeOff } from 'lucide-react';
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
import { DocumentViewer } from './blocks/document-viewer';
import { CognitiveUpdateCard } from './blocks/cognitive-update-card';
import { MusicRecommendationCard } from './blocks/music-recommendation-card';
import { OutfitRecommendationCard } from './blocks/outfit-recommendation-card';
import { useChatbot } from './context';
import { useToast } from '@/hooks/use-toast';

interface MessageProps {
    message: MessageType;
    onCopy?: () => void;
    onRetry?: () => void;
    onLike?: () => void;
    onDislike?: () => void;
}

const LANG_EXT_MAP: Record<string, string> = {
    html: '.html', css: '.css', javascript: '.js', js: '.js',
    typescript: '.ts', ts: '.ts', tsx: '.tsx', jsx: '.jsx',
    python: '.py', json: '.json', csv: '.csv', markdown: '.md',
    md: '.md', sql: '.sql', bash: '.sh', shell: '.sh', xml: '.xml',
    yaml: '.yml', yml: '.yml', java: '.java', cpp: '.cpp', c: '.c',
    csharp: '.cs', rust: '.rs', go: '.go', ruby: '.rb', php: '.php',
    swift: '.swift', kotlin: '.kt', dart: '.dart',
};

const LANG_MIME_MAP: Record<string, string> = {
    html: 'text/html', css: 'text/css', javascript: 'text/javascript',
    json: 'application/json', csv: 'text/csv', markdown: 'text/markdown',
    xml: 'application/xml', yaml: 'text/yaml', python: 'text/x-python',
};

const CodeBlock = ({ language, value }: { language: string; value: string }) => {
    const [copied, setCopied] = React.useState(false);
    const [showPreview, setShowPreview] = React.useState(false);
    const { toast } = useToast();

    const canPreview = ['html', 'css', 'svg', 'markdown', 'md'].includes(language?.toLowerCase());
    const ext = LANG_EXT_MAP[language?.toLowerCase()] || '.txt';
    const mimeType = LANG_MIME_MAP[language?.toLowerCase()] || 'text/plain';

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast({
            title: "Copiado",
            description: "Código copiado al portapapeles",
        });
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([value], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `code${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
            title: "Descargado",
            description: `Archivo code${ext} descargado`,
        });
    };

    return (
        <div className="relative group/code my-4 rounded-xl border border-white/[0.08] bg-[#0d0d0f] overflow-hidden shadow-lg shadow-black/20">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary/60" />
                    <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">{language}</span>
                </div>
                <div className="flex items-center gap-1">
                    {canPreview && (
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all active:scale-95 ${showPreview ? 'bg-primary/20 text-primary' : 'hover:bg-white/10 text-white/40'}`}
                            title={showPreview ? 'Ocultar vista previa' : 'Previsualizar'}
                        >
                            {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            {showPreview ? 'Ocultar' : 'Preview'}
                        </button>
                    )}
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/10 rounded-md transition-all active:scale-95 text-[10px] font-medium text-white/40"
                        title="Descargar"
                    >
                        <Download className="w-3 h-3" />
                        Descargar
                    </button>
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/10 rounded-md transition-all active:scale-95 text-[10px] font-medium text-white/40"
                    >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copiado' : 'Copiar'}
                    </button>
                </div>
            </div>

            {/* Code body — this is the critical overflow container */}
            <div className="overflow-x-auto overflow-y-hidden max-w-full">
                <SyntaxHighlighter
                    style={oneDark}
                    language={language}
                    PreTag="div"
                    className="!bg-transparent !m-0 !p-4 !text-[13px] !leading-relaxed"
                    showLineNumbers={true}
                    lineNumberStyle={{ minWidth: '2.5em', paddingRight: '1em', color: 'rgba(255,255,255,0.15)', textAlign: 'right', userSelect: 'none' }}
                    wrapLongLines={false}
                >
                    {value}
                </SyntaxHighlighter>
            </div>

            {/* Inline Preview for HTML */}
            {showPreview && canPreview && (
                <div className="border-t border-white/10">
                    <DocumentViewer
                        content={value}
                        mimeType={mimeType}
                        filename={`code${ext}`}
                        onClose={() => setShowPreview(false)}
                    />
                </div>
            )}
        </div>
    );
};

const MarkdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        const value = String(children).replace(/\n$/, '');

        return !inline && match ? (
            <CodeBlock language={match[1]} value={value} />
        ) : (
            <code
                className="px-1.5 py-0.5 bg-white/[0.08] rounded-md text-primary/90 font-mono text-[13px]"
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                {...props}
            >
                {children}
            </code>
        );
    },
    p({ children }: any) {
        return (
            <p
                className="mb-4 last:mb-0 leading-[1.8] text-white/90 text-[14px]"
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
            >
                {children}
            </p>
        );
    },
    ul({ children }: any) {
        return <ul className="list-disc pl-5 mb-4 space-y-1.5 text-white/80 text-[14px] leading-[1.7]">{children}</ul>;
    },
    ol({ children }: any) {
        return <ol className="list-decimal pl-5 mb-4 space-y-1.5 text-white/80 text-[14px] leading-[1.7]">{children}</ol>;
    },
    li({ children }: any) {
        return <li className="leading-[1.7]" style={{ overflowWrap: 'anywhere' }}>{children}</li>;
    },
    h1({ children }: any) {
        return <h1 className="text-xl font-semibold mb-4 mt-6 text-white border-b border-white/[0.06] pb-2">{children}</h1>;
    },
    h2({ children }: any) {
        return <h2 className="text-lg font-semibold mb-3 mt-5 text-white">{children}</h2>;
    },
    h3({ children }: any) {
        return <h3 className="text-base font-semibold mb-2 mt-4 text-white/95">{children}</h3>;
    },
    blockquote({ children }: any) {
        return (
            <blockquote className="border-l-2 border-primary/40 pl-4 italic my-4 text-white/50 bg-white/[0.02] py-2 rounded-r-lg">
                {children}
            </blockquote>
        );
    },
    table({ children }: any) {
        return (
            <div className="overflow-x-auto my-4 rounded-lg border border-white/[0.08]">
                <table className="min-w-full divide-y divide-white/[0.08]">{children}</table>
            </div>
        );
    },
    th({ children }: any) {
        return (
            <th className="px-4 py-2.5 bg-white/[0.04] text-left text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                {children}
            </th>
        );
    },
    td({ children }: any) {
        return (
            <td
                className="px-4 py-2.5 text-sm text-white/80 border-t border-white/[0.06]"
                style={{ overflowWrap: 'anywhere' }}
            >
                {children}
            </td>
        );
    },
    a({ href, children }: any) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/30 hover:decoration-primary/60 transition-colors"
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}
            >
                {children}
            </a>
        );
    },
    hr() {
        return <hr className="my-6 border-white/[0.06]" />;
    },
    strong({ children }: any) {
        return <strong className="font-semibold text-white">{children}</strong>;
    },
    em({ children }: any) {
        return <em className="italic text-white/70">{children}</em>;
    }
};

export function Message({ message, onCopy, onRetry, onLike, onDislike }: MessageProps) {
    const isUser = message.role === 'user';
    const { confirmAction, cancelAction, editMessage, likeMessage, dislikeMessage, retryMessage } = useChatbot();
    const { data: session } = useSession();
    const { toast } = useToast();

    const [isEditing, setIsEditing] = React.useState(false);
    const [editContent, setEditContent] = React.useState(message.content);

    const handleCopy = () => {
        if (onCopy) {
            onCopy();
        } else {
            navigator.clipboard.writeText(message.content);
            toast({
                title: "Copiado",
                description: "Mensaje copiado al portapapeles",
            });
        }
    };

    const handleRetry = () => {
        if (onRetry) onRetry();
        else retryMessage(message.id);
    };

    const handleLike = () => {
        if (onLike) onLike();
        else likeMessage(message.id);
    };

    const handleDislike = () => {
        if (onDislike) onDislike();
        else dislikeMessage(message.id);
    };


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
        <div
            className={`group flex gap-3 sm:gap-4 px-4 sm:px-6 py-5 transition-all duration-300 w-full max-w-full overflow-hidden ${isUser
                ? 'bg-transparent'
                : 'bg-white/[0.015]'
                }`}
        >
            {/* Avatar */}
            <div className="flex-shrink-0 pt-0.5">
                {isUser ? (
                    <Avatar className="h-8 w-8 rounded-xl ring-1 ring-white/10">
                        <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || 'User'} />
                        <AvatarFallback className="bg-white/[0.06] text-white/70 rounded-xl text-xs font-medium">
                            <User className="w-4 h-4" />
                        </AvatarFallback>
                    </Avatar>
                ) : (
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-primary/70 shadow-[0_0_12px_var(--primary-glow,rgba(99,102,241,0.25))] ring-1 ring-primary/30">
                        <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                )}
            </div>

            {/* Content — critical: min-w-0 + overflow-hidden prevents child overflow */}
            <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[13px] font-semibold text-white/90">
                        {isUser ? (session?.user?.name || 'User') : 'Novo AI'}
                    </span>
                    <span className="text-[11px] text-white/30 tabular-nums">
                        {new Date(message.timestamp).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                    {/* Model Badge — shows which specialist is responding */}
                    {!isUser && message.model && message.model !== 'auto' && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary/80 font-medium tracking-wider uppercase">
                            {message.model}
                        </span>
                    )}
                </div>

                {/* Attachments Preview */}
                {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-4">
                        {message.attachments.map((attachment) => {
                            const isImage = attachment.type.startsWith('image/');
                            return (
                                <div key={attachment.id} className="relative group/attachment max-w-[300px]">
                                    {isImage ? (
                                        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-white/5 shadow-xl transition-transform hover:scale-[1.02]">
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
                                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                                <Bot className="w-5 h-5 text-primary" />
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
                    <div className="space-y-2 overflow-hidden">
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
                                case 'cognitive_update':
                                    return <CognitiveUpdateCard key={block.id} content={block.content} />;
                                case 'music_recommendation':
                                    return <MusicRecommendationCard key={block.id} content={block.content} />;
                                case 'outfit_recommendation':
                                    return <OutfitRecommendationCard key={block.id} content={block.content} />;
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
                                className="w-full bg-white/5 border border-white/10 text-white rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                                rows={Math.max(3, editContent.split('\n').length)}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1.5 text-xs font-medium text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="px-4 py-1.5 text-xs font-semibold bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg transition-colors"
                                >
                                    Guardar y enviar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="max-w-none"
                            style={{
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word',
                                overflowX: 'hidden',
                            }}
                        >
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
                                className="text-xs bg-white/[0.03] hover:bg-primary/[0.08] text-white/60 hover:text-primary px-3 py-1.5 rounded-full transition-all duration-200 border border-white/[0.06] hover:border-primary/20"
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
                        onCopy={handleCopy}
                        onRetry={handleRetry}
                        onLike={handleLike}
                        onDislike={handleDislike}
                        onEdit={() => setIsEditing(true)}
                    />
                </div>
            </div>
        </div>
    );
}
