import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AnalysisBlockProps {
    content: string;
}

export function AnalysisBlock({ content }: AnalysisBlockProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="border border-white/5 rounded-xl bg-white/[0.02] overflow-hidden mb-3 transition-all duration-300">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white/40 hover:text-white/60 hover:bg-white/[0.02] transition-all"
            >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <Brain className="w-3.5 h-3.5 text-primary/70" />
                <span className="tracking-wide uppercase text-[10px]">Proceso de Pensamiento</span>
            </button>

            {isExpanded && (
                <div className="px-4 py-3 text-xs text-white/50 border-t border-white/5 bg-black/20 leading-relaxed break-words overflow-hidden w-full">
                    <ReactMarkdown>{content}</ReactMarkdown>
                </div>
            )}
        </div>
    );
}
