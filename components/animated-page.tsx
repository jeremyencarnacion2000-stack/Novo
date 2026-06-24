'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { animationPresets, AnimationVariant } from '@/lib/design-tokens';

interface AnimatedPageProps {
  children: React.ReactNode;
  variant?: AnimationVariant;
  className?: string;
}

export function AnimatedPage({
  children,
  variant = 'slideUp',
  className,
}: AnimatedPageProps) {
  const preset = animationPresets[variant];
  return (
    <motion.div
      initial={preset.initial}
      animate={preset.animate}
      exit={'exit' in preset ? preset.exit : undefined}
      transition={preset.transition as any}
      className={className}
    >
      {children}
    </motion.div>
  );
}
