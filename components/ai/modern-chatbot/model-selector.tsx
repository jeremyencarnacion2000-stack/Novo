'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useChatbot } from './context';

export function ModelSelector() {
    const { selectedModel, setSelectedModel, availableModels } = useChatbot();
    const [isOpen, setIsOpen] = React.useState(false);

    // Default to Llama 3.3 if not found, since selectedModel can be qwen-max which doesn't directly map in the hardcoded availableModels list
    const currentModel = availableModels.find(m => m.id === selectedModel) || availableModels[1] || { name: 'Cognitive Core', provider: 'Llama 3.3 70B' };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0f]/80 border border-white/5 hover:border-primary/30 rounded-full transition-all text-xs text-white/80 hover:text-white backdrop-blur-md shadow-inner"
            >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <span className="font-semibold tracking-wide">{currentModel?.name}</span>
                <span className="text-[10px] text-white/30 hidden xs:inline">({currentModel?.provider})</span>
                <ChevronDown className={`w-3 h-3 text-white/40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute left-0 bottom-full mb-2 w-64 bg-[#050508]/95 border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl z-50 py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {availableModels.map((model) => (
                            <button
                                key={model.id}
                                type="button"
                                onClick={() => {
                                    setSelectedModel(model.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors relative group ${selectedModel === model.id ? 'bg-primary/[0.03]' : ''
                                    }`}
                                disabled={!model.enabled}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 pr-2">
                                        <div className={`font-semibold text-xs tracking-wide transition-colors ${selectedModel === model.id ? 'text-primary' : 'text-white/80 group-hover:text-white'}`}>{model.name}</div>
                                        <div className="text-[10px] text-white/30 mt-0.5">{model.provider}</div>
                                        <div className="text-[10px] text-white/40 mt-1 leading-relaxed">{model.description}</div>
                                    </div>
                                    {selectedModel === model.id && (
                                        <div className="mt-1 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_var(--primary-glow)]"></div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
