'use client';

import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useChatbot } from './context';

export function TwinModeToggle() {
    const { twinMode, setTwinMode, twinModeAvailable } = useChatbot();
    const [upgrading, setUpgrading] = React.useState(false);

    const handleClick = async () => {
        if (!twinModeAvailable) {
            setUpgrading(true);
            try {
                const res = await fetch('/api/billing/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ interval: 'month' }),
                });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
            } catch {
                // Silent — this mirrors settings-billing.tsx's own checkout
                // error handling (a toast there; here we just stop spinning,
                // since a failed upgrade attempt from the chat composer
                // isn't as evidently a place to add auto-verifiying toast
                // infra of its own).
            } finally {
                setUpgrading(false);
            }
            return;
        }
        setTwinMode(!twinMode);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={upgrading}
            title={twinModeAvailable ? 'Modo Twin: usa tu perfil cognitivo completo' : 'Modo Twin — función Pro'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                twinModeAvailable && twinMode
                    ? 'bg-primary/15 border-primary/30 text-primary'
                    : 'bg-[#0a0a0f]/80 border-white/5 hover:border-primary/30 text-white/60 hover:text-white/80'
            }`}
        >
            {twinModeAvailable ? (
                <Sparkles className="w-3 h-3" />
            ) : (
                <Lock className="w-3 h-3" />
            )}
            <span>{twinModeAvailable ? (twinMode ? 'Modo Twin' : 'Modo Rápido') : 'Modo Twin'}</span>
            {!twinModeAvailable && (
                <span className="text-[9px] uppercase tracking-wide bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">Pro</span>
            )}
        </button>
    );
}
