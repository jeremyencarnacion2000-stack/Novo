'use client';

import React, { useState } from 'react';
import { Send, Paperclip, Image as ImageIcon, Globe } from 'lucide-react';
import './mini-chatbot.css';

export function MiniChatbot() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');

    return (
        <div className="mini-chatbot-container">
            {/* 15 invisible hover areas for 3D effect */}
            <div className="fixed inset-0 z-[998] pointer-events-none grid grid-cols-5 grid-rows-3">
                {[...Array(15)].map((_, i) => (
                    <div
                        key={i}
                        className={`hover-area-${i + 1} pointer-events-auto`}
                    />
                ))}
            </div>

            {/* Mini Chatbot Container */}
            <label
                className="mini-chatbot-label fixed bottom-8 right-8 z-[999] cursor-pointer group"
                style={{ perspective: '1000px' }}
            >
                <input
                    type="checkbox"
                    className="sr-only"
                    checked={isExpanded}
                    onChange={(e) => setIsExpanded(e.target.checked)}
                />

                {/* Card */}
                <div
                    className={`
            mini-chatbot-card
            relative
            transition-all duration-600 ease-out
            ${isExpanded ? 'w-[260px] h-[160px]' : 'w-48 h-48'}
            rounded-[3rem]
            ${!isExpanded && 'shadow-[0_10px_40px_rgba(0,0,60,0.25)] hover:shadow-[0_10px_40px_rgba(0,0,60,0.25),inset_0_0_10px_rgba(255,255,255,0.5)]'}
          `}
                    style={{
                        transformStyle: 'preserve-3d',
                        transform: 'translateZ(50px)'
                    }}
                >
                    {/* Animated Background Balls */}
                    <div className={`
            absolute inset-0 overflow-hidden
            transition-all duration-300
            ${isExpanded ? 'rounded-[20px]' : 'rounded-[3rem]'}
            bg-card/80 backdrop-blur-md
          `}>
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin-slow">
                            {/* Rosa (pink) ball */}
                            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-24 h-24 rounded-full bg-pink-500 blur-[30px]" />
                            {/* Violet ball */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-purple-500 blur-[30px]" />
                            {/* Green ball */}
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-emerald-400 blur-[30px]" />
                            {/* Cyan ball */}
                            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-24 h-24 rounded-full bg-cyan-400 blur-[30px]" />
                        </div>
                    </div>

                    {/* Eyes/Face */}
                    <div className={`
            absolute inset-0 flex items-center justify-center
            backdrop-blur-[50px]
            transition-opacity duration-300
            ${isExpanded ? 'opacity-0' : 'opacity-100'}
          `}>
                        {/* Normal eyes */}
                        <div className="flex gap-8 group-hover:hidden">
                            <div className="w-[26px] h-[52px] bg-white rounded-2xl animate-blink" />
                            <div className="w-[26px] h-[52px] bg-white rounded-2xl animate-blink" />
                        </div>

                        {/* Happy eyes (on hover) */}
                        <div className="hidden group-hover:flex gap-0 text-white">
                            <svg className="w-[60px]" fill="none" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z" />
                            </svg>
                            <svg className="w-[60px]" fill="none" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z" />
                            </svg>
                        </div>
                    </div>

                    {/* Chat Interface (when expanded) */}
                    <div className={`
            absolute inset-0 p-1.5
            transition-all duration-300
            ${isExpanded ? 'opacity-100 z-[99999] pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}>
                        <div className="w-full h-full bg-white rounded-[15px] p-1 flex flex-col justify-between">
                            {/* Chat textarea */}
                            <div className="relative flex-1">
                                <textarea
                                    placeholder="Imagine Something...✦˚"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    className="
                    w-full h-full p-2.5 
                    bg-transparent
                    border-none outline-none resize-none
                    text-muted-foreground text-xs
                    placeholder-muted-foreground/30
                    rounded-2xl
                  "
                                />
                            </div>

                            {/* Options */}
                            <div className="flex justify-between items-end p-2.5">
                                {/* Left buttons */}
                                <div className="flex gap-2">
                                    <button className="text-muted-foreground/20 hover:text-muted-foreground hover:-translate-y-1 transition-all">
                                        <Paperclip className="w-5 h-5" />
                                    </button>
                                    <button className="text-muted-foreground/20 hover:text-muted-foreground hover:-translate-y-1 transition-all">
                                        <ImageIcon className="w-5 h-5" />
                                    </button>
                                    <button className="text-muted-foreground/20 hover:text-muted-foreground hover:-translate-y-1 transition-all">
                                        <Globe className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Submit button */}
                                <button
                                    className="
                    p-0.5 rounded-[10px]
                    bg-gradient-to-t from-red-500 via-purple-600 to-blue-500
                    shadow-[inset_0_6px_2px_-4px_rgba(255,255,255,0.5)]
                    opacity-70 hover:opacity-100
                    transition-all active:scale-95
                  "
                                >
                                    <div className="w-[30px] h-[30px] p-1.5 bg-black/10 backdrop-blur-sm rounded-[10px] flex items-center justify-center text-gray-300 hover:text-white">
                                        <Send className="w-full h-full hover:drop-shadow-[0_0_5px_#ffffff] transition-all" />
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </label>
        </div>
    );
}
