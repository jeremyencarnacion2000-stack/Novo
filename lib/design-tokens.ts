// Design Tokens - Standardized values for consistent UI

export const designTokens = {
    spacing: {
        xs: '0.25rem',  // 4px
        sm: '0.5rem',   // 8px
        md: '1rem',     // 16px
        lg: '1.5rem',   // 24px
        xl: '2rem',     // 32px
        '2xl': '3rem',  // 48px
        '3xl': '4rem',  // 64px
    },

    radius: {
        sm: '0.25rem',  // 4px
        md: '0.5rem',   // 8px
        lg: '0.75rem',  // 12px
        xl: '1rem',     // 16px
        full: '9999px',
    },

    typography: {
        h1: 'text-3xl md:text-4xl font-bold tracking-tight',
        h2: 'text-2xl md:text-3xl font-bold tracking-tight',
        h3: 'text-xl md:text-2xl font-semibold',
        h4: 'text-lg md:text-xl font-semibold',
        body: 'text-base',
        small: 'text-sm',
        xs: 'text-xs',
    },

    transitions: {
        fast: '150ms',
        normal: '300ms',
        slow: '500ms',
    },

    shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    },
} as const;

// Animation presets for Framer Motion
export const animationPresets = {
    fadeIn: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.3 },
    },

    slideUp: {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { duration: 0.3 },
    },

    slideDown: {
        initial: { opacity: 0, y: -20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 20 },
        transition: { duration: 0.3 },
    },

    scaleIn: {
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.95 },
        transition: { duration: 0.2 },
    },

    stagger: {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    },

    staggerItem: {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
    },
} as const;
