'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useChatbot } from './context';

export function ModelSelector() {
    const { selectedModel, setSelectedModel, availableModels } = useChatbot();
    const [isOpen, setIsOpen] = React.useState(false);

    const currentModel = availableModels.find(m => m.id === selectedModel);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm"
            >
                <span className="font-medium text-white">{currentModel?.name}</span>
                <span className="text-zinc-400 text-xs">({currentModel?.provider})</span>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl z-50 py-1">
                        {availableModels.map((model) => (
                            <button
                                key={model.id}
                                onClick={() => {
                                    setSelectedModel(model.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors ${selectedModel === model.id ? 'bg-zinc-700/50' : ''
                                    }`}
                                disabled={!model.enabled}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="font-medium text-white text-sm">{model.name}</div>
                                        <div className="text-xs text-zinc-400 mt-0.5">{model.provider}</div>
                                        <div className="text-xs text-zinc-500 mt-1">{model.description}</div>
                                    </div>
                                    {selectedModel === model.id && (
                                        <div className="ml-2 w-2 h-2 bg-orange-500 rounded-full"></div>
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
