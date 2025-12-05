import React from 'react';
import ChatbotPanel from '@/chatbot/ChatbotPanel';
import { DashboardShell } from '@/components/dashboard-shell';

export default function AIPage() {
  return (
    <DashboardShell>
      <div className="-my-8 -mx-6 lg:-mx-8 h-full">
        <ChatbotPanel isOpen={true} />
      </div>
    </DashboardShell>
  );
}