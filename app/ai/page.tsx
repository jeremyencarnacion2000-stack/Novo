import React from 'react';
import ModernChatbot from '@/components/ai/modern-chatbot';

export default function AIPage() {
  return (
    // Mobile: no top/side padding — chat fills edge to edge.
    // Bottom: pb-[76px] clears the MobileNav (fixed bottom-4 + ~52px height).
    // Only the BOTTOM corners are rounded on mobile so the container sits
    // flush against the top/sides of the screen while having a soft curved
    // base resting above the navbar pill.
    // Desktop (md+): restore the padded floating card with full radius.
    <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden bg-transparent
                    p-0 pb-[76px] md:p-4 md:pb-4 lg:p-6 lg:pb-6">
      <div className="flex-1 min-h-0 w-full bg-[#0B0B0F] border-0 md:border border-white/10
                      rounded-t-none rounded-b-[36px] md:rounded-[36px]
                      flex flex-col overflow-hidden shadow-2xl relative">
        <ModernChatbot />
      </div>
    </div>
  );
}