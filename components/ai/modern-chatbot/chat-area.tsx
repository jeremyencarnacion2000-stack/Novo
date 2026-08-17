'use client';

import React, { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useChatbot } from './context';
import { Message as ChatMessage } from './message';
import { ThinkingSteps } from './thinking-steps';
import { NovoActivitySurface } from '@/components/ai/novo-activity-surface';

// Pure message list — index.tsx decides whether to show this or a hero, and
// owns the single persistent composer + voice overlay (one input surface,
// not a different one per view). This component only ever mounts once a
// chat is active, so it has no empty-state branch of its own to keep in sync.
export function ChatArea() {
    const { messages, isLoading, streamingMessage, currentConversationId, twinMode } = useChatbot();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const prevLengthRef = useRef(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const prevConversationIdRef = useRef<string | null>(null);
    // rAF handle for debounced streaming scroll — prevents firing hundreds of
    // times per second and avoids fighting user-initiated scroll positions.
    const streamingRafRef = useRef<number | null>(null);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (!scrollContainerRef.current) return;
        if (behavior === 'instant') {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        } else {
            requestAnimationFrame(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTo({
                        top: scrollContainerRef.current.scrollHeight,
                        behavior: 'smooth',
                    });
                }
            });
        }
    }, []);

    // Conversation switch — instant scroll before paint, no reflow
    useLayoutEffect(() => {
        if (currentConversationId !== prevConversationIdRef.current) {
            scrollToBottom('instant');
            prevConversationIdRef.current = currentConversationId;
        }
    }, [currentConversationId, scrollToBottom]);

    // New messages — instant for history loads, smooth for live messages.
    // Also triggers when isLoading flips true (spinner appears before stream starts).
    useEffect(() => {
        const currentLength = messages.length;
        if (currentLength === 0) { prevLengthRef.current = 0; return; }
        const isHistoryLoad = currentLength - prevLengthRef.current > 1;
        scrollToBottom(isHistoryLoad ? 'instant' : 'smooth');
        prevLengthRef.current = currentLength;
    }, [messages, scrollToBottom]);

    // Scroll when loading spinner appears (before stream begins)
    useEffect(() => {
        if (isLoading) scrollToBottom('smooth');
    }, [isLoading, scrollToBottom]);

    // Debounced streaming scroll — cancel any pending rAF before scheduling a
    // new one, so we fire at most once per animation frame during streaming.
    useEffect(() => {
        if (!streamingMessage) return;
        if (streamingRafRef.current !== null) {
            cancelAnimationFrame(streamingRafRef.current);
        }
        streamingRafRef.current = requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({
                    top: scrollContainerRef.current.scrollHeight,
                    behavior: 'smooth',
                });
            }
            streamingRafRef.current = null;
        });
        return () => {
            if (streamingRafRef.current !== null) {
                cancelAnimationFrame(streamingRafRef.current);
            }
        };
    }, [streamingMessage]);

    return (
        <div className="flex-1 flex flex-col relative min-h-0 bg-transparent overflow-hidden">
            {/* Messages scroll area */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar min-h-0 relative"
                data-lenis-prevent
            >
                <div className="w-full max-w-4xl mx-auto px-2 sm:px-6 pt-6 pb-8">
                    {messages.map((message) => (
                        <ChatMessage key={message.id} message={message} />
                    ))}
                    {streamingMessage && streamingMessage.content && (
                        <ChatMessage message={streamingMessage} />
                    )}
                    {/* Real pipeline stages (classifier/model from the `meta`
                        SSE event), not a canned spinner — hidden the moment
                        actual tokens start rendering as the message above. */}
                    {((isLoading && !streamingMessage) || (streamingMessage && !streamingMessage.content)) && (
                        <div className="space-y-2"><NovoActivitySurface runId={streamingMessage?.activityRunId ?? null} /><ThinkingSteps
                            modelLabel={streamingMessage && streamingMessage.model !== 'auto' ? streamingMessage.model ?? null : null}
                            intent={streamingMessage?.intent ?? null}
                            fallback={!!streamingMessage?.fallback}
                            agentMode={twinMode}
                        /></div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
        </div>
    );
}

export default ChatArea;
