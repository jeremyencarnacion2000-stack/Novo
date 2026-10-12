"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";

type LandingLocale = "en" | "es";
type SignalKey = "signal" | "context" | "direction";

type HeroSignalCardProps = {
  progress: MotionValue<number>;
  reduceMotion: boolean | null;
  locale: LandingLocale;
  label: SignalKey;
  className: string;
  accent: string;
  enterAt: number;
  enterX: number;
  exitX: number;
};

const COPY = {
  en: {
    signal: ["Signal", "A plan moved"],
    context: ["Context", "The thread stayed"],
    direction: ["Direction", "A next move formed"],
  },
  es: {
    signal: ["Señal", "Un plan cambió"],
    context: ["Contexto", "El hilo siguió"],
    direction: ["Dirección", "Surgió el siguiente paso"],
  },
} as const;

/**
 * Three semantic paper cards are placed on the thing they describe: a cloud
 * carries the incoming signal, the brain holds retained context, and the path
 * carries direction. A small drawn route lands before each card settles.
 */
function HeroSignalCard({
  progress,
  reduceMotion,
  locale,
  label,
  className,
  accent,
  enterAt,
  enterX,
  exitX,
}: HeroSignalCardProps) {
  const settleAt = enterAt + 0.13;
  const x = useTransform(
    progress,
    [enterAt, settleAt, 0.76, 1],
    [enterX, 0, 4, exitX],
  );
  const y = useTransform(
    progress,
    [enterAt, settleAt, 0.76, 1],
    [18, 0, -4, -14],
  );
  const opacity = useTransform(
    progress,
    [enterAt, settleAt, 0.76, 1],
    [0, 1, 1, 0],
  );
  const scale = useTransform(
    progress,
    [enterAt, settleAt, 0.76, 1],
    [0.94, 1, 1, 0.98],
  );

  return (
    <motion.div
      data-testid={`landing-hero-signal-${label}`}
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 hidden border border-[#31563F]/[0.24] bg-[#F5EEDC]/[0.91] px-4 py-2.5 shadow-[0_18px_34px_rgba(32,69,42,0.15)] lg:block ${className}`}
      style={reduceMotion ? undefined : { x, y, opacity, scale }}
    >
      <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#4E775B]">
        {COPY[locale][label][0]}
      </p>
      <p
        className="mt-1 text-[12px] font-medium tracking-[-0.025em]"
        style={{ color: accent }}
      >
        {COPY[locale][label][1]}
      </p>
    </motion.div>
  );
}

function HeroSignalTrail({
  progress,
  reduceMotion,
  enterAt,
  path,
  arrow,
}: {
  progress: MotionValue<number>;
  reduceMotion: boolean | null;
  enterAt: number;
  path: string;
  arrow: string;
}) {
  const pathLength = useTransform(
    progress,
    [Math.max(0, enterAt - 0.08), enterAt + 0.13, 1],
    [0, 1, 1],
  );
  const opacity = useTransform(
    progress,
    [Math.max(0, enterAt - 0.08), enterAt, 0.82, 1],
    [0, 0.8, 0.7, 0],
  );

  return (
    <motion.g style={reduceMotion ? undefined : { opacity }}>
      <motion.path
        d={path}
        fill="none"
        stroke="rgba(45,83,61,.72)"
        strokeWidth="0.24"
        strokeLinecap="round"
        strokeDasharray="1.1 1.55"
        style={reduceMotion ? undefined : { pathLength }}
      />
      <motion.path
        d={arrow}
        fill="none"
        stroke="rgba(45,83,61,.82)"
        strokeWidth="0.28"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={reduceMotion ? undefined : { pathLength }}
      />
    </motion.g>
  );
}

export function HeroSignalCards({
  progress,
  reduceMotion,
  locale,
}: {
  progress: MotionValue<number>;
  reduceMotion: boolean | null;
  locale: LandingLocale;
}) {
  return (
    <div
      data-testid="landing-hero-signal-cards"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[6] hidden lg:block"
    >
      <svg
        data-testid="landing-hero-signal-trails"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <HeroSignalTrail
          progress={progress}
          reduceMotion={reduceMotion}
          enterAt={0.1}
          path="M58 23 C62 17 67 13 72 16 C76 18 74 24 69 22 C66 21 67 17 71 16"
          arrow="M68.5 13.7 L72 16 L68.2 18.1"
        />
        <HeroSignalTrail
          progress={progress}
          reduceMotion={reduceMotion}
          enterAt={0.25}
          path="M83 51 C78 47 75 42 70 44 C66 45 66 50 69 52 C72 54 75 51 73 48"
          arrow="M70.2 45.1 L73 48 L69.2 49.1"
        />
        <HeroSignalTrail
          progress={progress}
          reduceMotion={reduceMotion}
          enterAt={0.4}
          path="M64 76 C70 72 74 75 75 80 C76 85 82 86 86 82"
          arrow="M82.2 81.6 L86 82 L83.6 85"
        />
      </svg>
      <HeroSignalCard
        progress={progress}
        reduceMotion={reduceMotion}
        locale={locale}
        label="signal"
        accent="#1D3528"
        enterAt={0.1}
        enterX={-28}
        exitX={-20}
        className="left-[57%] top-[15%] -rotate-[8deg] xl:left-[60%]"
      />
      <HeroSignalCard
        progress={progress}
        reduceMotion={reduceMotion}
        locale={locale}
        label="context"
        accent="#31563F"
        enterAt={0.25}
        enterX={26}
        exitX={22}
        className="right-[11%] top-[42%] rotate-[5deg] xl:right-[13%]"
      />
      <HeroSignalCard
        progress={progress}
        reduceMotion={reduceMotion}
        locale={locale}
        label="direction"
        accent="#173124"
        enterAt={0.4}
        enterX={-24}
        exitX={-18}
        className="left-[61%] top-[72%] -rotate-[4deg] xl:left-[64%]"
      />
    </div>
  );
}
