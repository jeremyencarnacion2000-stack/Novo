'use client'

import { motion } from 'framer-motion'
import { useSettings } from '@/lib/settings-context'

export default function Template({ children }: { children: React.ReactNode }) {
    const { settings } = useSettings()

    if (!settings.showAnimations) {
        return <>{children}</>
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{
                type: 'spring',
                stiffness: 110,
                damping: 20,
                mass: 0.9
            }}
            // flex + min-h-0 (not just w-full h-full): this template wraps
            // EVERY page, and its own parent (<main>) is a flex column with
            // min-h-0. Without matching flex context here, a plain block div
            // can't participate in that height-bounding chain — any page
            // built as "flex column, min-h-0, overflow-hidden, inner scroll"
            // (e.g. /ai's chat log) grows to fit ALL its content instead of
            // being clipped to the viewport. Measured on /ai: a message list
            // rendered 31,478px tall, pushing the composer that far down the
            // page — invisible until a conversation is long enough to reveal it.
            className="w-full h-full flex flex-col min-h-0"
            style={{ willChange: 'transform, opacity' }}
        >
            {children}
        </motion.div>
    )
}
