'use client';

import React, { useState } from 'react';
import { Copy, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MessageActionsProps {
  content: string;
  onRegenerate: () => void;
}

export function MessageActions({ content, onRegenerate }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handleLike = () => {
    setLiked(!liked);
    if (disliked) setDisliked(false);
  };

  const handleDislike = () => {
    setDisliked(!disliked);
    if (liked) setLiked(false);
  };

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-6 w-6 p-0 hover:bg-muted"
        title="Copiar"
      >
        <Copy className="h-3 w-3" />
        {copied && (
          <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            ¡Copiado!
          </span>
        )}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRegenerate}
        className="h-6 w-6 p-0 hover:bg-muted"
        title="Regenerar"
      >
        <RotateCcw className="h-3 w-3" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleLike}
        className={`h-6 w-6 p-0 hover:bg-muted ${liked ? 'text-green-500' : ''}`}
        title="Me gusta"
      >
        <ThumbsUp className={`h-3 w-3 ${liked ? 'fill-current' : ''}`} />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDislike}
        className={`h-6 w-6 p-0 hover:bg-muted ${disliked ? 'text-red-500' : ''}`}
        title="No me gusta"
      >
        <ThumbsDown className={`h-3 w-3 ${disliked ? 'fill-current' : ''}`} />
      </Button>
    </div>
  );
}