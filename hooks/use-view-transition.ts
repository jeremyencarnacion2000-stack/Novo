'use client';

import { flushSync } from 'react-dom';

/**
 * Safely executes a React state update or routing change wrapped in the native
 * browser View Transition API (document.startViewTransition).
 * Includes a robust fallback for browsers that do not support the API.
 * Uses flushSync to force React to flush DOM mutations synchronously for perfect capturing.
 * 
 * @param callback The function containing the React state mutation.
 */
export function safeViewTransition(callback: () => void) {
  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    'startViewTransition' in document
  ) {
    try {
      (document as any).startViewTransition(() => {
        flushSync(() => {
          callback();
        });
      });
    } catch (e) {
      console.warn('View Transition failed, using standard fallback', e);
      callback();
    }
  } else {
    callback();
  }
}
