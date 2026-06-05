'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2, Minimize2, Download, ExternalLink } from 'lucide-react';

interface DocumentViewerProps {
    content: string;
    mimeType: string;
    filename: string;
    onClose?: () => void;
}

export function DocumentViewer({ content, mimeType, filename, onClose }: DocumentViewerProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        setMounted(true);
        // Prevent body scroll when panel is open
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const isHTML = mimeType === 'text/html' || filename.endsWith('.html');
    const isCSV = mimeType === 'text/csv' || filename.endsWith('.csv');
    const isJSON = mimeType === 'application/json' || filename.endsWith('.json');
    const isMarkdown = mimeType === 'text/markdown' || filename.endsWith('.md');
    const isImage = mimeType.startsWith('image/') || !!filename.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i);

    const handleDownload = () => {
        try {
            const blob = new Blob([content], { type: mimeType || 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Download failed:', e);
        }
    };

    const handleOpenNewTab = () => {
        try {
            const blob = new Blob([content], { type: mimeType || 'text/plain' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (e) {
            console.error('Failed to open in new tab:', e);
        }
    };

    const parseCSV = (csv: string): string[][] => {
        const lines = csv.trim().split('\n');
        return lines.map(line => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            for (const char of line) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        });
    };

    const formatJSON = (json: string): string => {
        try {
            const parsed = JSON.parse(json);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return json;
        }
    };

    const panelContent = (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
                style={{ opacity: mounted ? 1 : 0 }}
            />

            {/* Side Panel */}
            <div
                className={`fixed top-0 right-0 z-[201] h-full flex flex-col bg-[#0B0B0F]/98 backdrop-blur-2xl shadow-[-8px_0_30px_rgba(0,0,0,0.5)] border-l border-white/10 transition-transform duration-300 ease-out ${isFullscreen ? 'w-full' : 'w-[min(600px,85vw)]'}`}
                style={{ transform: mounted ? 'translateX(0)' : 'translateX(100%)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03] shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-primary uppercase">
                                {filename.split('.').pop()}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <span className="text-sm font-medium text-white/90 truncate block">{filename}</span>
                            <span className="text-[10px] text-white/40 uppercase tracking-wider">{mimeType}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={handleOpenNewTab}
                            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            title="Abrir en nueva pestaña"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleDownload}
                            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            title="Descargar"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            title={isFullscreen ? 'Panel lateral' : 'Pantalla completa'}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors"
                                title="Cerrar"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    {isImage ? (
                        <div className="flex items-center justify-center p-6 h-full bg-black/20">
                            <img
                                src={content.startsWith('data:') ? content : `data:${mimeType};base64,${content}`}
                                alt={filename}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                            />
                        </div>
                    ) : isHTML ? (
                        <iframe
                            ref={iframeRef}
                            srcDoc={content}
                            className="w-full h-full bg-white border-0"
                            sandbox="allow-scripts allow-same-origin"
                            title={filename}
                            style={{ colorScheme: 'light' }}
                        />
                    ) : isCSV ? (
                        <div className="p-4 overflow-auto">
                            <table className="w-full text-xs border-collapse">
                                {parseCSV(content).map((row, rowIdx) => (
                                    <tr key={rowIdx} className={rowIdx === 0 ? 'border-b border-white/20' : 'border-b border-white/5'}>
                                        {row.map((cell, cellIdx) => (
                                            rowIdx === 0 ? (
                                                <th key={cellIdx} className="text-left px-3 py-2 text-white/80 font-semibold bg-white/5">
                                                    {cell}
                                                </th>
                                            ) : (
                                                <td key={cellIdx} className="px-3 py-1.5 text-white/60">
                                                    {cell}
                                                </td>
                                            )
                                        ))}
                                    </tr>
                                ))}
                            </table>
                        </div>
                    ) : isJSON ? (
                        <div className="p-4">
                            <pre className="text-xs text-green-300/80 font-mono whitespace-pre-wrap leading-relaxed bg-black/30 rounded-lg p-4 overflow-auto">
                                {formatJSON(content)}
                            </pre>
                        </div>
                    ) : isMarkdown ? (
                        <div className="p-4 prose prose-invert prose-sm max-w-none">
                            <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap leading-relaxed">
                                {content}
                            </pre>
                        </div>
                    ) : (
                        <div className="p-4">
                            <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap leading-relaxed">
                                {content}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    // Use portal to render at document body level so it overlays everything
    if (typeof window === 'undefined') return null;
    return createPortal(panelContent, document.body);
}
