"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";

type LandingLocale = "en" | "es";

type AssemblyNarrativeProps = {
  locale: LandingLocale;
  progress: MotionValue<number>;
  reduceMotion: boolean | null;
};

const COPY = {
  en: [
    ["Tasks", "3 open"],
    ["Calendar", "2 blocks"],
    ["Rhythm", "High focus"],
  ],
  es: [
    ["Tareas", "3 abiertas"],
    ["Calendario", "2 bloques"],
    ["Ritmo", "Foco alto"],
  ],
} as const;

/**
 * Scroll-linked editorial fragments that follow the hero promise. These source
 * cards let concrete streams arrive after the semantic hero establishes how
 * Novo turns signal, retained context, and direction into a next action.
 */
export function AssemblyNarrative({
  locale,
  progress,
  reduceMotion,
}: AssemblyNarrativeProps) {
  const signalX = useTransform(progress, [0, 0.16, 0.42, 1], [-38, 0, 8, 12]);
  const signalY = useTransform(progress, [0, 0.16, 0.42, 1], [20, 0, -7, -18]);
  const signalOpacity = useTransform(
    progress,
    [0, 0.1, 0.92, 1],
    [0, 1, 0.94, 0.66],
  );
  const contextX = useTransform(progress, [0, 0.28, 0.58, 1], [30, 0, -6, -15]);
  const contextY = useTransform(progress, [0, 0.28, 0.58, 1], [24, 0, -9, -24]);
  const contextOpacity = useTransform(
    progress,
    [0, 0.22, 0.94, 1],
    [0, 1, 0.96, 0.74],
  );
  const directionX = useTransform(
    progress,
    [0, 0.46, 0.76, 1],
    [36, 0, -10, -21],
  );
  const directionY = useTransform(
    progress,
    [0, 0.46, 0.76, 1],
    [28, 0, -12, -30],
  );
  const directionOpacity = useTransform(progress, [0, 0.4, 1], [0, 1, 0.82]);
  const connectionScale = useTransform(progress, [0.14, 0.72], [0, 1]);
  const connectionOpacity = useTransform(
    progress,
    [0.12, 0.3, 0.92],
    [0, 0.72, 0.36],
  );
  const copy = COPY[locale];

  return (
    <aside
      data-testid="landing-assembly-narrative"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden select-none lg:block"
    >
      <motion.div
        className="absolute left-[53%] top-[26%] origin-left"
        style={
          reduceMotion
            ? undefined
            : { scaleX: connectionScale, opacity: connectionOpacity }
        }
      >
        <div className="h-px w-[min(24vw,22rem)] bg-[linear-gradient(90deg,rgba(44,104,73,.66),rgba(44,104,73,.16),transparent)]" />
        <span className="absolute -left-1 -top-1 size-2 rounded-full border border-[#31563F]/30 bg-[#F1E7D5]" />
      </motion.div>

      <motion.div
        className="absolute left-[52%] top-[22%] -rotate-[8deg] border border-[#31563F]/[0.24] bg-[#F5EEDC]/[0.91] px-4 py-2.5 shadow-[0_18px_34px_rgba(32,69,42,0.15)]"
        style={
          reduceMotion
            ? undefined
            : { x: signalX, y: signalY, opacity: signalOpacity }
        }
      >
        <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#4E775B]">
          {copy[0][0]}
        </p>
        <p className="mt-1 text-[12px] font-medium tracking-[-0.025em] text-[#1D3528]">
          {copy[0][1]}
        </p>
      </motion.div>

      <motion.div
        className="absolute right-[15%] top-[44%] rotate-[5deg] border border-[#31563F]/[0.2] bg-[#DDE8D0]/[0.9] px-4 py-2.5 shadow-[0_18px_34px_rgba(32,69,42,0.14)]"
        style={
          reduceMotion
            ? undefined
            : { x: contextX, y: contextY, opacity: contextOpacity }
        }
      >
        <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#3E7250]">
          {copy[1][0]}
        </p>
        <p className="mt-1 text-[12px] font-medium tracking-[-0.025em] text-[#1D3528]">
          {copy[1][1]}
        </p>
      </motion.div>

      <motion.div
        className="absolute right-[28%] top-[69%] -rotate-[4deg] border border-[#31563F]/[0.22] bg-[#B9DBB4]/[0.92] px-4 py-2.5 shadow-[0_18px_34px_rgba(32,69,42,0.14)]"
        style={
          reduceMotion
            ? undefined
            : { x: directionX, y: directionY, opacity: directionOpacity }
        }
      >
        <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#326A45]">
          {copy[2][0]}
        </p>
        <p className="mt-1 text-[12px] font-medium tracking-[-0.025em] text-[#173124]">
          {copy[2][1]}
        </p>
      </motion.div>
    </aside>
  );
}
