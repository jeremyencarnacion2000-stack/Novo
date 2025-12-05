import React from 'react';
import { MiniChatbot } from '@/components/ai/mini-chatbot';

export default function MiniChatbotPage() {
    return (
        <div className="relative w-full h-screen bg-gradient-to-br from-background via-secondary to-accent">
            <MiniChatbot />

            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-foreground mb-4">
                        Mini AI Chatbot
                    </h1>
                    <p className="text-muted-foreground">
                        Mueve el mouse sobre la pantalla para ver efectos 3D
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                        Click en el chatbot para expandir
                    </p>
                </div>
            </div>
        </div>
    );
}
