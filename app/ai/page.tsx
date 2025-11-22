import { Chatbot } from '@/components/ai/chatbot';

export default function AIPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">AI Assistant</h1>
        <p className="text-muted-foreground">
          Your personal AI assistant for managing tasks, habits, and productivity.
        </p>
      </div>

      <div className="flex justify-center">
        <Chatbot />
      </div>
    </div>
  );
}