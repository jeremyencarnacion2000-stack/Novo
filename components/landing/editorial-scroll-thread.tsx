"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";

type EditorialThreadVariant = "flow" | "sequence" | "product";

const THREADS: Record<
  EditorialThreadVariant,
  { path: string; arrow: string; points: Array<[number, number]> }
> = {
  flow: {
    path: "M12 2 C26 9 2 18 13 29 C24 40 35 33 27 48 C20 61 4 61 12 73 C21 86 37 80 29 98",
    arrow: "M25.5 94.5 L29 98 L32.5 94.7",
    points: [
      [12, 2],
      [27, 48],
      [29, 98],
    ],
  },
  sequence: {
    path: "M88 2 C72 10 97 19 86 30 C75 42 64 35 73 50 C81 63 97 59 89 73 C81 86 65 80 73 98",
    arrow: "M69.5 94.6 L73 98 L76.6 94.8",
    points: [
      [88, 2],
      [73, 50],
      [73, 98],
    ],
  },
  product: {
    path: "M4 68 C20 54 28 76 40 63 C50 52 42 40 54 35 C67 29 70 49 83 41 C91 36 91 27 97 24",
    arrow: "M92.7 23 L97 24 L94.4 28",
    points: [
      [4, 68],
      [54, 35],
      [97, 24],
    ],
  },
};

/**
 * A quiet editorial route that hands attention from one chapter to the next.
 * It follows real section progress and remains secondary to product content.
 */
export function EditorialScrollThread({
  progress,
  reduceMotion,
  variant,
  className = "",
}: {
  progress: MotionValue<number>;
  reduceMotion: boolean | null;
  variant: EditorialThreadVariant;
  className?: string;
}) {
  const pathLength = useTransform(progress, [0.03, 0.86], [0, 1]);
  const opacity = useTransform(
    progress,
    [0, 0.12, 0.82, 1],
    [0.16, 0.82, 0.72, 0.3],
  );
  const thread = THREADS[variant];

  return (
    <svg
      data-testid={`landing-editorial-thread-${variant}`}
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute ${className}`}
    >
      <path
        d={thread.path}
        fill="none"
        stroke="var(--landing-line)"
        strokeWidth="0.24"
        strokeLinecap="round"
        strokeDasharray="1.1 1.8"
        opacity="0.65"
      />
      <motion.path
        d={thread.path}
        fill="none"
        stroke="rgba(113,216,143,.82)"
        strokeWidth="0.32"
        strokeLinecap="round"
        strokeDasharray="1.1 1.8"
        style={reduceMotion ? { pathLength: 1, opacity: 0.62 } : { pathLength, opacity }}
      />
      <motion.path
        d={thread.arrow}
        fill="none"
        stroke="rgba(113,216,143,.9)"
        strokeWidth="0.38"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={reduceMotion ? { opacity: 0.62 } : { pathLength, opacity }}
      />
      {thread.points.map(([cx, cy], index) => (
        <motion.circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={index === 1 ? 0.78 : 0.58}
          fill={index === 1 ? "#DCCF9F" : "#ADEBC1"}
          style={reduceMotion ? { opacity: 0.72 } : { opacity }}
        />
      ))}
    </svg>
  );
}
