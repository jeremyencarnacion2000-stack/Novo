import React from 'react';
import ModernChatbot from '@/components/ai/modern-chatbot';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

export default function AIPage() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Header */}
          <div className="flex items-center gap-2 border-b bg-background px-4 py-3 md:hidden flex-shrink-0">
            <SidebarTrigger />
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">N</span>
            </div>
            <div>
              <h2 className="text-base font-bold leading-none">Novo</h2>
              <p className="text-xs text-muted-foreground">Productivity Hub</p>
            </div>
          </div>

          {/* Chatbot - Full height with min-h-0 for proper flex shrink */}
          <div className="flex-1 min-h-0">
            <ModernChatbot />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}