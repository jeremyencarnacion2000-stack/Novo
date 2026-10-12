"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";

/**
 * A slow, legible handoff from the Twin to the user's first action. It is an
 * editorial route, not a decorative connector: the path is only drawn after
 * the closing Twin has settled into view.
 */
export function ClosingTwinPath({
  progress,
  reduceMotion,
}: {
  progress: MotionValue<number>;
  reduceMotion: boolean | null;
}) {
  const pathLength = useTransform(progress, [0, 0.3, 0.82, 1], [0, 0, 1, 1]);
  const opacity = useTransform(progress, [0, 0.22, 0.38, 1], [0, 0, 0.9, 0.9]);

  return (
    <svg
      data-testid="landing-closing-twin-path"
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 z-[4] hidden h-full w-full lg:block"
    >
      <motion.path
        d="M78 29 C71 31 70 39 76 42 C82 45 83 38 79 35 C74 32 68 40 63 48 C58 57 53 55 49 61 C44 69 36 67 32 72 C27 79 24 83 16 77"
        fill="none"
        stroke="rgba(173,235,193,.76)"
        strokeWidth="0.22"
        strokeLinecap="round"
        strokeDasharray="1.1 1.55"
        style={reduceMotion ? undefined : { pathLength, opacity }}
      />
      <motion.path
        d="M13 73 L16 77 L21 74"
        fill="none"
        stroke="rgba(173,235,193,.86)"
        strokeWidth="0.26"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={reduceMotion ? undefined : { pathLength, opacity }}
      />
      <motion.circle
        cx="16"
        cy="77"
        r="0.72"
        fill="#ADEBC1"
        style={reduceMotion ? undefined : { opacity }}
      />
    </svg>
  );
}
