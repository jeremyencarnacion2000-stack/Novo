'use client';

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface FeedbackButtonsProps {
  messageId: string;
  onFeedback?: (messageId: string, type: 'positive' | 'negative') => void;
}

export function FeedbackButtons({ messageId, onFeedback }: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);

  const handleFeedback = (type: 'positive' | 'negative') => {
    if (feedback === type) {
      // Si ya está seleccionado, quitar feedback
      setFeedback(null);
      onFeedback?.(messageId, type === 'positive' ? 'negative' : 'positive'); // Toggle logic
    } else {
      setFeedback(type);
      onFeedback?.(messageId, type);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => handleFeedback('positive')}
        className={`p-1 rounded hover:bg-accent transition-colors ${
          feedback === 'positive' ? 'text-green-600 bg-green-50 dark:bg-green-950' : 'text-muted-foreground'
        }`}
        aria-label="Feedback positivo"
        title="Me gusta esta respuesta"
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => handleFeedback('negative')}
        className={`p-1 rounded hover:bg-accent transition-colors ${
          feedback === 'negative' ? 'text-red-600 bg-red-50 dark:bg-red-950' : 'text-muted-foreground'
        }`}
        aria-label="Feedback negativo"
        title="No me gusta esta respuesta"
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}