"use client";

import Image from "next/image";
import { motion, useTransform, type MotionValue } from "framer-motion";

type HeroTwinCutoutProps = {
  progress: MotionValue<number>;
  reduceMotion: boolean | null;
  placement?: "hero" | "assembly" | "final";
};

/**
 * A tactile collage layer, exported as its own image so it shares the paper
 * grain, lighting, and physical cut edges of the rest of the hero scene. The
 * slow local-axis turn is intentionally restrained: this is a living model,
 * not a spinning dashboard ornament.
 */
export function HeroTwinCutout({
  progress,
  reduceMotion,
  placement = "hero",
}: HeroTwinCutoutProps) {
  const isAssembly = placement === "assembly";
  const isFinal = placement === "final";
  // The same object has two adjacent scroll stages: it settles in the hero,
  // then the following chapter receives it from below before it resolves into
  // its smaller, inspectable position. This avoids a repeated illustration.
  const x = useTransform(
    progress,
    isAssembly ? [0, 0.26, 1] : isFinal ? [0, 0.3, 1] : [0, 0.76, 1],
    isAssembly
      ? ["13%", "2%", "-3%"]
      : isFinal
        ? ["10%", "0%", "-4%"]
        : ["2%", "-3%", "10%"],
  );
  const y = useTransform(
    progress,
    isAssembly ? [0, 0.26, 1] : isFinal ? [0, 0.3, 1] : [0, 0.76, 1],
    isAssembly
      ? ["29%", "4%", "-9%"]
      : isFinal
        ? ["14%", "0%", "-7%"]
        : ["4%", "-9%", "-26%"],
  );
  const scale = useTransform(
    progress,
    isAssembly ? [0, 0.26, 1] : isFinal ? [0, 0.3, 1] : [0, 0.78, 1],
    isAssembly
      ? [0.78, 0.96, 1.035]
      : isFinal
        ? [0.78, 1, 1.035]
        : [0.92, 1, 1.08],
  );
  const opacity = useTransform(
    progress,
    isAssembly ? [0, 0.18, 1] : isFinal ? [0, 0.24, 1] : [0, 0.12, 0.76, 1],
    isAssembly ? [0, 0.96, 0.78] : isFinal ? [0, 0.98, 1] : [1, 1, 0.98, 0],
  );

  return (
    <motion.figure
      data-testid="landing-hero-twin-cutout"
      aria-hidden="true"
      className={
        placement === "assembly"
          ? "absolute right-[3%] top-[10%] z-[5] hidden w-[min(34vw,31rem)] min-w-[20rem] origin-center select-none lg:block"
          : placement === "final"
            ? "absolute right-[3%] top-[9%] z-[5] hidden w-[min(31vw,28rem)] min-w-[18rem] origin-center select-none lg:block"
            : "absolute right-[-3.5rem] top-[19%] z-[5] hidden w-[min(31vw,29rem)] min-w-[19rem] origin-center select-none lg:block xl:right-[1%]"
      }
      style={reduceMotion ? undefined : { x, y, scale, opacity }}
    >
      <motion.div
        className="relative aspect-square [perspective:1200px]"
        animate={
          reduceMotion
            ? undefined
            : { rotateZ: [-2.4, 2.4, -2.4], rotateY: [-5, 6, -5] }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 15, repeat: Infinity, ease: [0.42, 0, 0.58, 1] }
        }
      >
        <motion.div
          className="absolute inset-[5%] rounded-full border border-[#31563F]/[0.18]"
          animate={reduceMotion ? undefined : { rotate: [0, 360] }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 52, repeat: Infinity, ease: "linear" }
          }
        >
          <span className="absolute -left-1 top-[32%] size-2.5 rounded-full border border-[#31563F]/35 bg-[#F5EEDC] shadow-[0_5px_14px_rgba(18,49,31,0.14)]" />
          <span className="absolute right-[5%] top-[11%] size-2 rounded-full bg-[#8DCC9B] shadow-[0_4px_12px_rgba(24,91,58,0.24)]" />
          <span className="absolute bottom-[8%] right-[17%] size-2.5 rounded-full border border-[#31563F]/30 bg-[#D9C99A] shadow-[0_5px_14px_rgba(18,49,31,0.12)]" />
        </motion.div>
        <div className="pointer-events-none absolute inset-[12%] rounded-full border border-dashed border-[#31563F]/[0.18] [border-width:1.5px]" />
        <Image
          src="/landing/novo-hero-twin-cutout-v1.webp"
          alt=""
          fill
          sizes="(max-width: 1279px) 31vw, 29rem"
          className="object-contain drop-shadow-[0_30px_36px_rgba(21,51,32,0.2)]"
        />
      </motion.div>
    </motion.figure>
  );
}
