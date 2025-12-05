import React from 'react';
import ModernChatbot from '@/components/ai/modern-chatbot';
import { DashboardShell } from '@/components/dashboard-shell';

export default function AIPage() {
  return (
    <DashboardShell>
      <ModernChatbot />
    </DashboardShell>
  );
}