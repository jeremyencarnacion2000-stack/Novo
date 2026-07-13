import React from 'react';
import ModernChatbot from '@/components/ai/modern-chatbot';

export default function AIPage() {
  return (
    <div className="flex-1 min-h-0 w-full p-4 lg:p-6 flex flex-col overflow-hidden bg-transparent">
      <div className="flex-1 min-h-0 w-full bg-[#0B0B0F] border border-white/10 rounded-[28px] flex flex-col overflow-hidden shadow-2xl relative">
        <ModernChatbot />
      </div>
    </div>
  );
}