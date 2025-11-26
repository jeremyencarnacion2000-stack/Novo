import { GrokChatbot } from '@/components/ai/chatbot';
import { DashboardShell } from '@/components/dashboard-shell';

export default function AIPage() {
  return (
    <DashboardShell>
      <div className="-my-8 -mx-6 lg:-mx-8 h-full">
        <GrokChatbot />
      </div>
    </DashboardShell>
  );
}