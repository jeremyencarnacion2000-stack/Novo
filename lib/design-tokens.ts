/**
 * Novo Design Language (NDL) v1.0 Design Tokens
 * centralizing all design rules, colors, motion settings, radii, and grid spacings.
 */

export const NDL_TOKENS = {
  // ── Color System ──────────────────────────────────────────────────────────
  colors: {
    primary: {
      neuralPurple: '#7C3AED',   // Thinking / IA / Peak Focus
      executionBlue: '#3B82F6',  // Action / Linear Execution
      recoveryCyan: '#06B6D4',   // Repose / Recovery / Synaptic Fatigue
      signalWhite: '#F8FAFC',    // Highlight text / high contrast
      surface: '#080808',        // Contained elements / cards
      background: '#040404',     // Underlying canvas
    },
    semantic: {
      morado: '#7C3AED',   // Thought / AI / Peak Focus
      azul: '#3B82F6',     // Execution / Actions / Linear
      cyan: '#06B6D4',     // Recovery / Quiet / Fatigue
      verde: '#10B981',    // Success / Completed / Progress
      ambar: '#F59E0B',    // Warning / Medium cognitive load
      rojo: '#EF4444',     // Critical / Overload / Stress
    }
  },

  // ── Grid & Spacing System (Strictly official pixel values / rem equivalents) ──
  spacing: {
    xs: '4px',       // 0.25rem
    sm: '8px',       // 0.5rem
    md: '12px',      // 0.75rem
    lg: '16px',      // 1rem
    xl: '24px',      // 1.5rem
    '2xl': '32px',   // 2rem
    '3xl': '40px',   // 2.5rem
    '4xl': '64px',   // 4rem
    '5xl': '96px',   // 6rem
  },

  // ── Border Radius System ──────────────────────────────────────────────────
  radius: {
    card: '20px',    // Standard card rounded corner
    panel: '28px',   // Large dashboard containers
    dialog: '34px',  // Modals & overlays
    orb: '999px',    // Perfectly circular elements
  },

  // ── Typography System ──────────────────────────────────────────────────────
  typography: {
    display: {
      fontSize: '72px',
      fontWeight: '200', // ExtraLight
      fontStyle: 'italic',
      letterSpacing: 'normal',
    },
    section: {
      fontSize: '34px',
      fontWeight: '600', // SemiBold
      letterSpacing: 'normal',
    },
    metric: {
      fontSize: '52px',
      fontWeight: '700', // Bold
      fontFamily: 'monospace', // Mono
      letterSpacing: '-0.02em',
    },
    label: {
      fontSize: '11px',
      fontWeight: '700', // Bold / Black
      textTransform: 'uppercase' as const,
      letterSpacing: '0.28em',
    },
    body: {
      fontSize: '16px',
      fontWeight: '400', // Regular
      letterSpacing: 'normal',
    },
    caption: {
      fontSize: '13px',
      fontWeight: '500', // Medium
      letterSpacing: 'normal',
    }
  },

  // ── Easing Curves & Timing ────────────────────────────────────────────────
  motion: {
    easing: {
      deceleration: 'cubic-bezier(0.16, 1, 0.3, 1)',   // Premium fast out, slow in
      transition: 'cubic-bezier(0.65, 0, 0.35, 1)',     // Cognitive bi-directional transition
    },
    durations: {
      hover: 120,       // ms
      press: 90,        // ms
      card: 220,        // ms
      panel: 350,       // ms
      navigation: 450,  // ms
      adaptation: 800,  // ms
      prediction: 1000, // ms
    }
  },

  // ── Bloom Levels (Ambient glows) ──────────────────────────────────────────
  bloom: {
    soft: '0 0 12px rgba(124, 102, 241, 0.15)',
    medium: '0 0 24px rgba(124, 102, 241, 0.35)',
    strong: '0 0 50px rgba(124, 102, 241, 0.65)', // Central orb, Hero, AI only
  },

  // ── Shadow System ─────────────────────────────────────────────────────────
  shadows: {
    xs: '0 2px 4px rgba(0,0,0,0.15)',
    s: '0 12px 40px rgba(0,0,0,0.35)',
    m: '0 25px 70px rgba(0,0,0,0.45)',
    l: '0 35px 90px rgba(0,0,0,0.55)',
    xl: '0 50px 120px rgba(0,0,0,0.65)',
  }
} as const;

export type NdlTokens = typeof NDL_TOKENS;

// ── Spring Configs ────────────────────────────────────────────────────────────
export const springConfig = {
  snappy:  { type: 'spring' as const, stiffness: 500, damping: 30 },
  smooth:  { type: 'spring' as const, stiffness: 380, damping: 32 },
  gentle:  { type: 'spring' as const, stiffness: 260, damping: 28 },
  wobbly:  { type: 'spring' as const, stiffness: 200, damping: 14 },
} as const;

// ── Animation Presets (Framer Motion variants) ────────────────────────────────
export const animationPresets = {
  fadeIn: {
    initial:   { opacity: 0 },
    animate:   { opacity: 1 },
    exit:      { opacity: 0 },
    transition: { duration: 0.22, ease: 'easeOut' },
  },
  slideUp: {
    initial:   { opacity: 0, y: 18 },
    animate:   { opacity: 1, y: 0 },
    exit:      { opacity: 0, y: -10, transition: { duration: 0.18 } },
    transition: { type: 'spring', stiffness: 380, damping: 32 },
  },
  slideDown: {
    initial:   { opacity: 0, y: -18 },
    animate:   { opacity: 1, y: 0 },
    exit:      { opacity: 0, y: 10, transition: { duration: 0.18 } },
    transition: { type: 'spring', stiffness: 380, damping: 32 },
  },
  scaleIn: {
    initial:   { opacity: 0, scale: 0.95 },
    animate:   { opacity: 1, scale: 1 },
    exit:      { opacity: 0, scale: 0.97, transition: { duration: 0.16 } },
    transition: { type: 'spring', stiffness: 420, damping: 30 },
  },
  slideRight: {
    initial:   { opacity: 0, x: -24 },
    animate:   { opacity: 1, x: 0 },
    exit:      { opacity: 0, x: 24, transition: { duration: 0.18 } },
    transition: { type: 'spring', stiffness: 360, damping: 30 },
  },
  blur: {
    initial:   { opacity: 0, filter: 'blur(8px)', scale: 0.98 },
    animate:   { opacity: 1, filter: 'blur(0px)', scale: 1 },
    exit:      { opacity: 0, filter: 'blur(4px)', transition: { duration: 0.2 } },
    transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
  },
} as const;

export type AnimationVariant = keyof typeof animationPresets;
