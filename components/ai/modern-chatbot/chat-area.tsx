'use client';

import React, { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useChatbot } from './context';
import { Message as ChatMessage } from './message';
import { NovoThinkingPill } from '@/components/ai/novo-thinking-pill';
import { shouldReduceNovoMotion } from '@/hooks/use-novo-motion-policy';

// Pure message list — index.tsx decides whether to show this or a hero, and
// owns the single persistent composer + voice overlay (one input surface,
// not a different one per view). This component only ever mounts once a
// chat is active, so it has no empty-state branch of its own to keep in sync.
export function ChatArea() {
    const { messages, isLoading, streamingMessage, currentConversationId } = useChatbot();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const prevLengthRef = useRef(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const prevConversationIdRef = useRef<string | null>(null);
    // rAF handle for debounced streaming scroll — prevents firing hundreds of
    // times per second and avoids fighting user-initiated scroll positions.
    const streamingRafRef = useRef<number | null>(null);
    const followLatestRef = useRef(true);
    const lastScrollTopRef = useRef(0);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (!scrollContainerRef.current) return;
        if (behavior === 'instant' || shouldReduceNovoMotion()) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            lastScrollTopRef.current = scrollContainerRef.current.scrollTop;
        } else {
            requestAnimationFrame(() => {
                if (scrollContainerRef.current && followLatestRef.current) {
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
            followLatestRef.current = true;
            scrollToBottom('instant');
            prevConversationIdRef.current = currentConversationId;
            prevLengthRef.current = messages.length;
        }
    }, [currentConversationId, messages.length, scrollToBottom]);

    // New messages — instant for history loads, smooth for live messages.
    // Also triggers when isLoading flips true (spinner appears before stream starts).
    useEffect(() => {
        const currentLength = messages.length;
        if (currentLength === 0) { prevLengthRef.current = 0; return; }
        if (currentLength === prevLengthRef.current) return;
        const isHistoryLoad = currentLength - prevLengthRef.current > 1;
        if (messages[currentLength - 1]?.role === 'user') followLatestRef.current = true;
        if (followLatestRef.current) scrollToBottom(isHistoryLoad ? 'instant' : 'smooth');
        prevLengthRef.current = currentLength;
    }, [messages, scrollToBottom]);

    // Scroll when loading spinner appears (before stream begins)
    useEffect(() => {
        if (isLoading && followLatestRef.current) scrollToBottom('smooth');
    }, [isLoading, scrollToBottom]);

    // Debounced streaming scroll — cancel any pending rAF before scheduling a
    // new one, so we fire at most once per animation frame during streaming.
    useEffect(() => {
        if (!streamingMessage || !followLatestRef.current) return;
        if (streamingRafRef.current !== null) {
            cancelAnimationFrame(streamingRafRef.current);
        }
        streamingRafRef.current = requestAnimationFrame(() => {
            if (scrollContainerRef.current && followLatestRef.current) {
                // Follow new text directly; restarting smooth scroll on each
                // token creates a trailing animation that fights the reader.
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                lastScrollTopRef.current = scrollContainerRef.current.scrollTop;
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
                onScroll={(event) => {
                    const scroller = event.currentTarget;
                    const nearBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 80;
                    // Intermediate frames of a smooth downward follow are not reader intent.
                    if (nearBottom) followLatestRef.current = true;
                    else if (scroller.scrollTop < lastScrollTopRef.current) followLatestRef.current = false;
                    lastScrollTopRef.current = scroller.scrollTop;
                }}
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
                    {/* One physical surface follows the real activity stream.
                        AnimatePresence lets it resolve into the first response
                        token instead of disappearing between two paint frames. */}
                    <AnimatePresence initial={false}>
                        {((isLoading && !streamingMessage) || (streamingMessage && !streamingMessage.content)) ? (
                            <NovoThinkingPill
                                key="novo-thinking-pill"
                                runId={streamingMessage?.activityRunId ?? null}
                                modelLabel={streamingMessage && streamingMessage.model !== 'auto' ? streamingMessage.model ?? null : null}
                                intent={streamingMessage?.intent ?? null}
                                fallback={!!streamingMessage?.fallback}
                            />
                        ) : null}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>
            </div>
        </div>
    );
}

export default ChatArea;
