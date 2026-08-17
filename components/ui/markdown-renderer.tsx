import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
    const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
    const [isDark, setIsDark] = React.useState(true);

    React.useEffect(() => {
        const root = document.documentElement;
        const syncTheme = () => setIsDark(root.classList.contains('dark'));
        syncTheme();
        const observer = new MutationObserver(syncTheme);
        observer.observe(root, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const handleCopy = (code: string, index: number) => {
        navigator.clipboard.writeText(code);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className={cn("prose prose-sm dark:prose-invert max-w-none break-words", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const code = String(children).replace(/\n$/, '');
                        const index = node?.position?.start?.line || 0;

                        if (!inline && match) {
                            return (
                                <div className="relative my-4 rounded-lg overflow-hidden border border-border bg-muted/65 dark:bg-[#1e1e1e]">
                                    <div className="flex items-center justify-between px-4 py-2 bg-muted/90 dark:bg-[#2d2d2d] border-b border-border/70">
                                        <span className="text-xs font-medium text-muted-foreground lowercase">
                                            {match[1]}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                            onClick={() => handleCopy(code, index)}
                                        >
                                            {copiedIndex === index ? (
                                                <Check className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </div>
                                    <SyntaxHighlighter
                                        {...props}
                                        style={isDark ? vscDarkPlus : oneLight}
                                        language={match[1]}
                                        PreTag="div"
                                        customStyle={{
                                            margin: 0,
                                            padding: '1rem',
                                            background: 'transparent',
                                            fontSize: '0.875rem',
                                            lineHeight: '1.5',
                                        }}
                                    >
                                        {code}
                                    </SyntaxHighlighter>
                                </div>
                            );
                        }

                        return (
                            <code
                                className={cn(
                                    "bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary",
                                    className
                                )}
                                {...props}
                            >
                                {children}
                            </code>
                        );
                    },
                    p({ children }) {
                        return <p className="mb-4 last:mb-0 leading-7">{children}</p>;
                    },
                    ul({ children }) {
                        return <ul className="my-4 ml-6 list-disc [&>li]:mt-2">{children}</ul>;
                    },
                    ol({ children }) {
                        return <ol className="my-4 ml-6 list-decimal [&>li]:mt-2">{children}</ol>;
                    },
                    li({ children }) {
                        return <li className="leading-7">{children}</li>;
                    },
                    h1({ children }) {
                        return <h1 className="scroll-m-20 text-2xl font-bold tracking-tight mb-4 mt-6 first:mt-0">{children}</h1>;
                    },
                    h2({ children }) {
                        return <h2 className="scroll-m-20 text-xl font-semibold tracking-tight mb-3 mt-5">{children}</h2>;
                    },
                    h3({ children }) {
                        return <h3 className="scroll-m-20 text-lg font-semibold tracking-tight mb-2 mt-4">{children}</h3>;
                    },
                    blockquote({ children }) {
                        return (
                            <blockquote className="mt-4 border-l-4 border-primary/50 pl-4 italic text-muted-foreground">
                                {children}
                            </blockquote>
                        );
                    },
                    a({ href, children }) {
                        return (
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                            >
                                {children}
                            </a>
                        );
                    },
                    table({ children }) {
                        return (
                            <div className="my-4 w-full overflow-y-auto">
                                <table className="w-full border-collapse border border-border text-sm">
                                    {children}
                                </table>
                            </div>
                        );
                    },
                    th({ children }) {
                        return <th className="border border-border bg-muted px-4 py-2 text-left font-bold">{children}</th>;
                    },
                    td({ children }) {
                        return <td className="border border-border px-4 py-2">{children}</td>;
                    },
                    hr() {
                        return <hr className="my-6 border-border" />;
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
