import React, { useEffect } from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';

interface ErrorToastProps {
  error: {
    type: 'network' | 'api' | 'validation' | 'timeout' | 'unknown';
    message: string;
    details?: string;
  };
  onDismiss: () => void;
  onRetry?: () => void;
  autoDismiss?: boolean;
}

export function ErrorToast({ error, onDismiss, onRetry, autoDismiss = true }: ErrorToastProps) {
  useEffect(() => {
    if (autoDismiss) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onDismiss]);

  const getErrorIcon = (type: string) => {
    return <AlertCircle className="h-4 w-4 flex-shrink-0" />;
  };

  const getErrorColor = (type: string) => {
    switch (type) {
      case 'network': return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300';
      case 'api': return 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300';
      case 'validation': return 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200';
      case 'timeout': return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300';
      default: return 'border-border bg-card text-foreground';
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg border shadow-lg ${getErrorColor(error.type)}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        {getErrorIcon(error.type)}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{error.message}</p>
          {error.details && (
            <p className="text-xs opacity-90 mt-1 break-words">{error.details}</p>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1 mt-2 text-xs underline hover:no-underline"
            >
              <RefreshCw className="h-3 w-3" />
              Reintentar
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-current/70 hover:text-current transition-colors"
          aria-label="Cerrar mensaje de error"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
