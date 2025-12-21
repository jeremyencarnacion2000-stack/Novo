import React from 'react';
import ModernChatbot from '@/components/ai/modern-chatbot';

export default function AIPage() {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Mobile Header - Optional, can be kept if needed for mobile specific view, but DashboardShell has MobileNav */}

      {/* Chatbot - Full height */}
      <div className="flex-1 min-h-0">
        <ModernChatbot />
      </div>
    </div>
  );
}