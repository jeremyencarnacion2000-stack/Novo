export type MotionPreference = "normal" | "reduced";
let query: MediaQueryList | undefined;
export function motionPreference(): MotionPreference {
  if (typeof globalThis.matchMedia !== "function") return "normal";
  query ??= globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  return query.matches ? "reduced" : "normal";
}
export function presentationPose<T extends { sx: number; sy: number; tilt: number }>(pose: T, preference: MotionPreference): T {
  return preference === "normal" ? pose : { ...pose, sx: 1, sy: 1, tilt: 0 };
}
