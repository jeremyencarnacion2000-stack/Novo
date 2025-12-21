import React from 'react';
import { CheckCircle2, XCircle, Terminal } from 'lucide-react';

interface ResultBlockProps {
    success: boolean;
    output: string;
    metadata?: any;
}

export function ResultBlock({ success, output, metadata }: ResultBlockProps) {
    return (
        <div className={`border rounded-lg overflow-hidden mb-2 ${success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
            }`}>
            <div className={`px-3 py-2 border-b flex items-center gap-2 ${success ? 'border-green-500/30 text-green-500' : 'border-red-500/30 text-red-500'
                }`}>
                {success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                <span className="text-sm font-semibold">{success ? 'Executed Successfully' : 'Execution Failed'}</span>
            </div>

            <div className="p-3">
                {output && (
                    <div className="font-mono text-xs bg-black/50 p-2 rounded text-muted-foreground whitespace-pre-wrap">
                        {output}
                    </div>
                )}

                {metadata && (
                    <div className="mt-2 text-xs text-muted-foreground">
                        {Object.entries(metadata).map(([key, value]) => (
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
