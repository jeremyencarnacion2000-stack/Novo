'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { animationPresets } from '@/lib/design-tokens';

interface AnimatedPageProps {
    children: React.ReactNode;
    variant?: 'fadeIn' | 'slideUp' | 'slideDown' | 'scaleIn';
}

export function AnimatedPage({ children, variant = 'slideUp' }: AnimatedPageProps) {
    return (
        <motion.div
            {...animationPresets[variant]}
        >
            {children}
        </motion.div>
    );
}
