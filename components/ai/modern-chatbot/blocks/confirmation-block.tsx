import React from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';

interface ConfirmationBlockProps {
    onConfirm: () => void;
    onCancel: () => void;
    status: 'waiting' | 'confirmed' | 'cancelled';
}

export function ConfirmationBlock({ onConfirm, onCancel, status }: ConfirmationBlockProps) {
    if (status !== 'waiting') {
        return (
            <div className={`flex items-center gap-2 text-sm font-medium ${status === 'confirmed' ? 'text-green-500' : 'text-red-500'
                } mb-2`}>
                {status === 'confirmed' ? (
                    <>
                        <Check className="w-4 h-4" />
                        <span>Confirmed</span>
                    </>
                ) : (
                    <>
                        <X className="w-4 h-4" />
                        <span>Cancelled</span>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-4 mb-2">
            <div className="flex items-center gap-2 text-yellow-500 mb-3">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-semibold">Confirmation Required</span>
            </div>
            <div className="flex gap-3">
                <button
                    onClick={onConfirm}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                    <Check className="w-4 h-4" />
                    Confirm
                </button>
                <button
                    onClick={onCancel}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors"
                >
                    <X className="w-4 h-4" />
                    Cancel
                </button>
            </div>
        </div>
    );
}
