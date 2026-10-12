// Novo's own character, drawn on the existing Coucou motion engine.
import type { EyeShape } from "./engine";
import { getNovoGeometry, NOVO_PALETTE, type NovoDetail, type NovoOval } from "./novo-geometry";
export { novoBodyPoint } from "./novo-geometry";
export const NOVO_TOP = "#404249";
export const NOVO_BOTTOM = NOVO_PALETTE.shell;
export const NOVO_EYE = NOVO_PALETTE.eye;

export function novoBodyPath(rx: number, ry: number): Path2D {
  const p = new Path2D(), g = getNovoGeometry(rx, ry, "main");
  if (!g) return p;
  g.shell.forEach((q, i) => i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y));
  p.closePath(); return p;
}
const ellipse = (x: CanvasRenderingContext2D, o: NovoOval) => {
  x.beginPath(); x.ellipse(o.x, o.y, o.rx, o.ry, 0, 0, Math.PI * 2); x.fill();
};
export function drawNovoFeatures(x: CanvasRenderingContext2D, rx: number, ry: number,
  options: { detail: NovoDetail; morph: number; faceX: number; faceY: number }) {
  const g = getNovoGeometry(rx, ry, options.detail);
  if (!g || ![options.morph, options.faceX, options.faceY].every(Number.isFinite)) return;
  const m = Math.max(0, Math.min(1, options.morph));
  x.save(); x.globalAlpha *= 1 - m; x.fillStyle = NOVO_PALETTE.shell;
  for (const antenna of g.antennae) {
    x.beginPath(); antenna.forEach((p, i) => i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)); x.closePath(); x.fill();
  }
  for (const foot of g.feet) ellipse(x, foot);
  x.restore(); x.save();
  x.clip(novoBodyPath(rx, ry));
  // Chest details remain behind the moving face, inside the same shell mask.
  if (g.emblem && m < 1) {
    x.save();
    x.globalAlpha *= 1 - m; x.fillStyle = NOVO_PALETTE.emblem; ellipse(x, g.emblem);
    x.fillStyle = "rgba(255,255,255,.6)";
    ellipse(x, { ...g.emblem, x: -g.emblem.rx * .25, y: g.emblem.y - g.emblem.ry * .3, rx: g.emblem.rx * .25, ry: g.emblem.ry * .22 });
    if (g.amber) { x.fillStyle = NOVO_PALETTE.amber; ellipse(x, g.amber); }
    x.restore();
  }
  // Face follows the old gaze coordinates; no new motion is introduced.
  x.fillStyle = NOVO_PALETTE.face;
  ellipse(x, { ...g.face, x: options.faceX, y: options.faceY + ry * .14 * m });
  x.restore();
}
export function drawNovoEye(x: CanvasRenderingContext2D, shape: EyeShape, w: number, h: number,
  side = 1, openness = 1, time = 0, ink: string = NOVO_EYE) {
  if (![w, h, openness, time].every(Number.isFinite) || w <= 0 || h <= 0) return;
  x.save(); x.fillStyle = ink; x.strokeStyle = ink; x.lineCap = "round"; x.lineJoin = "round";
  const pill = (ww = w * .72, hh = Math.max(h * 1.15 * Math.max(0, openness), w * .18)) => {
    x.beginPath(); x.roundRect(-ww / 2, -hh / 2, ww, hh, Math.min(ww, hh) / 2); x.fill();
  };
  const arc = (happy: boolean) => {
    x.lineWidth = w * .28; x.beginPath();
    x.arc(0, happy ? h * .18 : -h * .08, w * .72,
      Math.PI * (happy ? 1.12 : .15), Math.PI * (happy ? 1.88 : .85)); x.stroke();
  };
  switch (shape) {
    case "pill": pill(); break;
    case "wide": pill(w * .86, Math.max(h * 1.28 * openness, w * .18)); break;
    case "dot": x.beginPath(); x.arc(0, 0, w * .45, 0, Math.PI * 2); x.fill(); break;
    case "line": x.rotate(-side * .2); pill(w * 1.3, w * .25); break;
    case "flat": pill(w * 1.3, w * .25); break;
    case "happy": arc(true); break;
    case "closed": arc(false); break;
    case "wink": side < 0 ? pill() : arc(true); break;
    case "tired": pill(w * .72, h * .35); x.fillRect(-w * .6, -h * .16, w * 1.2, w * .18); break;
    case "cup": {
      const hh = Math.max(h * openness, w * .18), r = Math.min(w / 2, hh / 2);
      x.beginPath(); x.moveTo(-w / 2, -hh / 2); x.lineTo(w / 2, -hh / 2);
      x.lineTo(w / 2, hh / 2 - r); x.quadraticCurveTo(w / 2, hh / 2, w / 2 - r, hh / 2);
      x.lineTo(-w / 2 + r, hh / 2); x.quadraticCurveTo(-w / 2, hh / 2, -w / 2, hh / 2 - r); x.closePath(); x.fill(); break;
    }
    case "heart": {
      const s = w * 1.1; x.beginPath(); x.moveTo(0, s * .5);
      x.bezierCurveTo(-s * 1.05, -s * .15, -s * .5, -s * .95, 0, -s * .38);
      x.bezierCurveTo(s * .5, -s * .95, s * 1.05, -s * .15, 0, s * .5); x.closePath(); x.fill(); break;
    }
    case "star":
      x.rotate(time * 1.5 * side); x.beginPath();
      for (let i = 0; i < 10; i++) { const r = w * (i % 2 ? .43 : 1), a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      x.closePath(); x.fill(); break;
    case "spiral":
      x.lineWidth = w * .18; x.beginPath();
      for (let a = 0; a < 4.4 * Math.PI; a += .2) {
        const r = w * (.04 + a * .05), aa = a + time * 9 * side;
        if (!a) x.moveTo(Math.cos(aa) * r, Math.sin(aa) * r); else x.lineTo(Math.cos(aa) * r, Math.sin(aa) * r);
      }
      x.stroke(); break;
  }
  x.restore();
}
