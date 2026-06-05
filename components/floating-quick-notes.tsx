'use client';

import React from 'react';
import { StickyNote } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuickCapture } from '@/lib/quick-capture-context';
import { cn } from '@/lib/utils';

export function FloatingQuickNotes() {
    const { onOpen } = useQuickCapture();

    return (
        <motion.button
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpen}
            className={cn(
                "fixed bottom-24 right-4 z-50",
                "h-12 w-12 rounded-full",
                "bg-white/5 backdrop-blur-md border border-white/10",
                "flex items-center justify-center",
                "text-white/40 hover:text-primary hover:border-primary/50 transition-all duration-300",
                "shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-primary/20",
                "group"
            )}
            title="Quick Note (Ctrl+Shift+N)"
        >
            <StickyNote size={20} className="group-hover:rotate-12 transition-transform" />

            {/* Tooltip hint for desktop */}
            <div className="absolute right-14 px-3 py-1.5 rounded-lg bg-black/80 border border-white/10 backdrop-blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                <span className="text-[10px] font-black tracking-widest uppercase italic text-white/60">
                    Notas Rápidas
                </span>
            </div>
        </motion.button>
    );
}
