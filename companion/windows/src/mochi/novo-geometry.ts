// Novo's complete character stays within the original motion envelope.
export type NovoDetail = "main" | "mini" | "icon";
export interface NovoPoint { x: number; y: number }
export interface NovoOval extends NovoPoint { rx: number; ry: number }
export interface NovoGeometry {
  shell: readonly NovoPoint[]; face: NovoOval;
  antennae: readonly [readonly NovoPoint[], readonly NovoPoint[]];
  feet: readonly NovoOval[]; emblem: NovoOval | null; amber: NovoOval | null;
  bounds: { left: number; right: number; top: number; bottom: number };
}
export const NOVO_PALETTE = Object.freeze({
  shell: "#26272c", face: "#fff3df", eye: "#17181c", emblem: "#34d399", amber: "#f5a524",
});
export function novoBodyPoint(angle: number, rx: number, ry: number): NovoPoint {
  const c = Math.cos(angle), s = Math.sin(angle), e = 2 / 3.1;
  return { x: rx * .96 * Math.sign(c) * Math.abs(c) ** e,
    y: ry * (.06 + .76 * Math.sign(s) * Math.abs(s) ** e) };
}
export function getNovoGeometry(rx: number, ry: number, detail: NovoDetail): NovoGeometry | null {
  if (![rx, ry].every(v => Number.isFinite(v) && v >= .5)) return null;
  const oval = (x: number, y: number, w: number, h: number): NovoOval => ({ x: x * rx, y: y * ry, rx: w * rx, ry: h * ry });
  const antenna = (side: number): NovoPoint[] => [
    { x: side * rx * .38, y: -ry * .57 }, { x: side * rx * .50, y: -ry * .94 },
    { x: side * rx * .60, y: -ry * .94 }, { x: side * rx * .47, y: -ry * .57 },
  ];
  const small = detail === "mini";
  return {
    shell: Array.from({ length: 73 }, (_, i) => novoBodyPoint(i / 72 * Math.PI * 2, rx, ry)),
    face: oval(0, .10, .79, .44), antennae: [antenna(-1), antenna(1)],
    feet: small ? [] : [oval(-.40, .88, .15, .10), oval(.40, .88, .15, .10)],
    emblem: small ? null : oval(0, .63, .125, .15),
    amber: small || rx < 8 ? null : oval(.29, .60, .035, .042),
    bounds: { left: -.96 * rx, right: .96 * rx, top: -.94 * ry, bottom: .98 * ry },
  };
}
