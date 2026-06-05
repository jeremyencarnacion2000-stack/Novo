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
            className="w-full h-full"
            style={{ willChange: 'transform, opacity' }}
        >
            {children}
        </motion.div>
    )
}
