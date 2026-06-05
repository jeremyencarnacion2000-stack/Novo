import React, { useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, ExternalLink, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { DocumentViewer } from './document-viewer';

interface ResultBlockProps {
    success: boolean;
    output: string;
    metadata?: any;
    onRetry?: () => void;
}

export function ResultBlock({ success, output, metadata, onRetry }: ResultBlockProps) {
    const sectionName = metadata?.sectionName;
    const redirectPath = metadata?.redirectPath;
    const [showPreview, setShowPreview] = useState(false);

    const canPreview = success && metadata?.content && (
        metadata?.mimeType === 'text/html' ||
        metadata?.mimeType === 'text/csv' ||
        metadata?.mimeType === 'application/json' ||
        metadata?.mimeType === 'text/markdown' ||
        metadata?.mimeType === 'text/plain' ||
        metadata?.mimeType?.startsWith('image/') ||
        metadata?.filename?.match(/\.(html|csv|json|md|txt|png|jpg|jpeg|gif|webp|svg)$/i)
    );

    return (
        <div className="space-y-2.5 max-w-full overflow-hidden">
            <div className={`border rounded-xl overflow-hidden shadow-md transition-all duration-300 ${
                success 
                    ? 'border-emerald-500/20 bg-emerald-500/[0.015]' 
                    : 'border-rose-500/20 bg-rose-500/[0.015]'
            }`}>
                {/* Header */}
                <div className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 text-xs font-semibold ${
                    success ? 'border-emerald-500/15 text-emerald-400 bg-emerald-500/[0.02]' : 'border-rose-500/15 text-rose-400 bg-rose-500/[0.02]'
                }`}>
                    <div className="flex items-center gap-2">
                        {success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                        <span>{success ? 'Ejecutado con éxito' : 'Error de ejecución'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                        {canPreview && (
                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-lg transition-colors active:scale-[0.96] ${
                                    showPreview
                                        ? 'bg-primary/20 text-primary border border-primary/20'
                                        : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/80 border border-white/[0.06]'
                                }`}
                            >
                                {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {showPreview ? 'Ocultar' : 'Previsualizar'}
                            </button>
                        )}
                        {success && metadata?.downloadReady && metadata?.content && (
                            <button
                                onClick={() => {
                                    try {
                                        const content = metadata.content;
                                        const blob = new Blob([content], { type: metadata.mimeType || 'text/plain' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = metadata.filename || 'download.txt';
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    } catch (e) {
                                        console.error('Download failed:', e);
                                    }
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-lg border border-primary/15 transition-colors active:scale-[0.96]"
                            >
                                <ExternalLink className="w-3 h-3 rotate-90" />
                                Descargar
                            </button>
                        )}
                        {success && redirectPath && sectionName && (
                            <Link
                                href={redirectPath}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/15 transition-colors active:scale-[0.96]"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Ver en {sectionName}
                            </Link>
                        )}
                        {!success && onRetry && (
                            <button
                                onClick={onRetry}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg border border-rose-500/15 transition-colors active:scale-[0.96]"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Reintentar
                            </button>
                        )}
                    </div>
                </div>

                {/* Content area */}
                <div className="p-3.5 space-y-3 min-w-0 w-full overflow-hidden">
                    {output && (
                        <div 
                            className={`p-3 rounded-lg text-xs leading-[1.6] ${
                                success 
                                    ? 'bg-emerald-500/[0.04] text-emerald-100/90 border border-emerald-500/[0.06]' 
                                    : 'bg-rose-500/[0.04] text-rose-100/90 border border-rose-500/[0.06]'
                            }`}
                            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                        >
                            {output}
                        </div>
                    )}

                    {/* Prominent download/preview buttons for files inside output card */}
                    {success && metadata?.downloadReady && (
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => {
                                    try {
                                        const fileContent = metadata.content || output || '';
                                        const blob = new Blob([fileContent], { type: metadata.mimeType || 'text/plain' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = metadata.filename || 'documento.txt';
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    } catch (e) {
                                        console.error('Download failed:', e);
                                    }
                                }}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-semibold transition-all active:scale-[0.98]"
                            >
                                <ExternalLink className="w-3.5 h-3.5 rotate-90" />
                                Descargar {metadata.filename || 'archivo'}
                            </button>

                            {canPreview && (
                                <button
                                    onClick={() => setShowPreview(!showPreview)}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] text-white/80 border border-white/[0.08] rounded-lg text-xs font-semibold transition-all"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    {showPreview ? 'Ocultar' : 'Vista Previa'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Metadata details rendering */}
                    {metadata && Object.keys(metadata).length > 0 && (
                        <div className="text-[11px] text-white/40 space-y-1 pt-1.5 border-t border-white/[0.04] w-full min-w-0">
                            {Object.entries(metadata)
                                .filter(([key]) => !['sectionName', 'redirectPath', 'executionTime', 'content', 'mimeType', 'downloadReady', 'type', 'filename'].includes(key))
                                .filter(([, value]) => typeof value !== 'object' || value === null)
                                .map(([key, value]) => (
                                    <div key={key} className="flex flex-wrap gap-1 leading-relaxed">
                                        <span className="font-semibold text-white/50">{key}:</span>
                                        <span className="text-white/80 break-words max-w-full" style={{ overflowWrap: 'anywhere' }}>
                                            {String(value)}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Inline Document Viewer */}
            {showPreview && metadata?.content && (
                <DocumentViewer
                    content={metadata.content}
                    mimeType={metadata.mimeType || 'text/plain'}
                    filename={metadata.filename || 'document'}
                    onClose={() => setShowPreview(false)}
                />
            )}
        </div>
    );
}
