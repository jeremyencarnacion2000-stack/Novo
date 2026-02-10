import React from 'react';
import { CheckCircle2, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface ResultBlockProps {
    success: boolean;
    output: string;
    metadata?: any;
    onRetry?: () => void;
}

export function ResultBlock({ success, output, metadata, onRetry }: ResultBlockProps) {
    const sectionName = metadata?.sectionName;
    const redirectPath = metadata?.redirectPath;

    return (
        <div className={`border rounded-lg overflow-hidden mb-2 ${success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
            }`}>
            <div className={`px-3 py-2 border-b flex items-center justify-between ${success ? 'border-green-500/30 text-green-500' : 'border-red-500/30 text-red-500'
                }`}>
                <div className="flex items-center gap-2">
                    {success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span className="text-sm font-semibold">{success ? 'Executed Successfully' : 'Execution Failed'}</span>
                </div>
                <div className="flex items-center gap-2">
                    {success && redirectPath && sectionName && (
                        <Link
                            href={redirectPath}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded transition-colors"
                        >
                            <ExternalLink className="w-3 h-3" />
                            Ver en {sectionName}
                        </Link>
                    )}
                    {!success && onRetry && (
                        <button
                            onClick={onRetry}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Reintentar
                        </button>
                    )}
                </div>
            </div>

            <div className="p-3">
                {output && (
                    <div className="font-mono text-xs bg-black/50 p-2 rounded text-muted-foreground whitespace-pre-wrap">
                        {output}
                    </div>
                )}

                {metadata && (
                    <div className="mt-2 text-xs text-muted-foreground">
                        {Object.entries(metadata).filter(([key]) => !['sectionName', 'redirectPath', 'executionTime'].includes(key)).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                                <span className="font-semibold opacity-70">{key}:</span>
                                <span>{String(value)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
