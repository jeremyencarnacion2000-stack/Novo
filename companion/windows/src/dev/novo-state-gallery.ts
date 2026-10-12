// Dev-only visual acceptance. This module is not a production build entry.
import { BotEngine, BOT_STATES, hexToRGB } from "../mochi/engine";
import { Greeting } from "../mochi/greeting";
import { UploadCanvas } from "../upload/canvas";
import { UploadSeq } from "../upload/sequence";
import { Sound } from "../core/sound";
import type { BotEmoteName, BotStateName } from "../core/layout";
import type { MotionPreference } from "../core/motion-policy";

Sound.enabled = false;
const states = Object.keys(BOT_STATES) as BotStateName[];
const emotes: BotEmoteName[] = ["love", "surprised", "proud", "wink", "yawn", "happy", "annoyed"];
const sizes = [20, 44, 58, 66];
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const preference = () => get<HTMLSelectElement>("motion").value as MotionPreference;

/** Same clock, fixed 1/60 step and random as the frozen motion sampler.
 * Timers are scoped to this synchronous sandbox, never left on the real page.
 */
class LocalClock {
  ms = 0;
  private nextId = 0;
  private timers = new Map<number, { at: number; run: () => void }>();
  scope<T>(run: () => T): T {
    const saved = { now: performance.now, random: Math.random, set: window.setTimeout, clear: window.clearTimeout };
    performance.now = () => this.ms;
    Math.random = () => .425;
    window.setTimeout = ((fn: TimerHandler, delay = 0) => {
      const id = ++this.nextId;
      if (typeof fn === "function") this.timers.set(id, { at: this.ms + delay, run: () => fn() });
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = id => { if (id !== undefined) this.timers.delete(id); };
    try { return run(); }
    finally { performance.now = saved.now; Math.random = saved.random; window.setTimeout = saved.set; window.clearTimeout = saved.clear; }
  }
  advance(ms: number, update?: () => void) {
    this.ms = ms;
    this.scope(() => {
      for (;;) {
        const due = [...this.timers].filter(([, t]) => t.at <= ms).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        this.timers.delete(due[0]); due[1].run();
      }
      update?.();
    });
  }
}

function canvas(size: number): { el: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const el = document.createElement("canvas"), dpr = Math.min(2, devicePixelRatio || 1);
  el.width = Math.round(size * dpr); el.height = Math.round(size * dpr);
  el.style.width = `${size}px`; el.style.height = `${size}px`;
  const ctx = el.getContext("2d")!; ctx.scale(dpr, dpr);
  return { el, ctx };
}

function specimen(name: string, size: number, options: { state?: BotStateName; emote?: BotEmoteName; color?: string } = {}) {
  const card = document.createElement("article"); card.className = "sample " + get<HTMLSelectElement>("surface").value;
  const title = document.createElement("strong"); title.textContent = name;
  const note = document.createElement("small"); note.textContent = `${size} px · ${preference()}`;
  const pair = document.createElement("div"); pair.className = "pair";
  const clock = new LocalClock();
  const bot = clock.scope(() => {
    const b = new BotEngine(); b.isMini = !!options.color;
    if (options.color) b.bodyColor = hexToRGB(options.color);
    if (options.state) b.setState(options.state, true);
    if (options.emote) b.triggerEmote(options.emote);
    return b;
  });
  const frames = options.emote ? 39 : 120;
  for (let frame = 0; frame <= frames; frame++) clock.advance(frame * 1000 / 60, () => bot.update(1 / 60));
  const sample = canvas(size); clock.scope(() => bot.draw(sample.ctx, size, size, preference()));
  sample.el.setAttribute("aria-label", name); pair.append(sample.el); card.append(title, pair, note);
  get("contact-sheet").append(card);
}

function contactSheet() {
  get("contact-sheet").replaceChildren();
  for (const state of states) specimen(state, 66, { state });
  for (const emote of emotes) specimen(emote, 66, { emote });
  for (const size of sizes) specimen(`Novo · ${size}`, size);
  for (const color of ["#6366f1", "#34d399", "#f5a524", "#26272c"]) specimen(`Mini · ${color}`, 20, { color });
}

const interactiveClock = new LocalClock();
const bot = interactiveClock.scope(() => new BotEngine());
bot.onDizzy = () => bot.setState("dizzy");
const interactive = get<HTMLCanvasElement>("interactive"), ctx = interactive.getContext("2d")!;
for (const [id, values] of [["state", states], ["emote", emotes]] as const) {
  for (const value of values) { const option = document.createElement("option"); option.value = value; option.textContent = value; get(id).append(option); }
}
get("state").addEventListener("change", () => interactiveClock.scope(() => bot.setState(get<HTMLSelectElement>("state").value as BotStateName)));
get("emote").addEventListener("change", () => interactiveClock.scope(() => bot.triggerEmote(get<HTMLSelectElement>("emote").value as BotEmoteName)));
for (const [id, action] of [["squash", () => bot.squash()], ["roll", () => bot.doRoll(950, 1)], ["slap", () => bot.slap()]] as const) get(id).addEventListener("click", () => interactiveClock.scope(action));
interactive.addEventListener("pointermove", event => {
  const r = interactive.getBoundingClientRect(); bot.lookX = (event.clientX - r.left - r.width / 2) / (r.width / 2); bot.lookY = (event.clientY - r.top - r.height / 2) / (r.height / 2);
});
interactive.addEventListener("pointerleave", () => { bot.lookX = 0; bot.lookY = 0; });

function greeting() {
  const time = Number(get<HTMLInputElement>("greeting-time").value), clock = new LocalClock(), greet = new Greeting();
  clock.scope(() => greet.start());
  if (get<HTMLInputElement>("interrupt").checked && time >= 1.6) { clock.advance(1600); clock.scope(() => greet.interrupt()); }
  clock.advance(time * 1000); clock.scope(() => greet.draw(get<HTMLCanvasElement>("greeting").getContext("2d")!, preference()));
  get("greeting-time-value").textContent = `${time.toFixed(2)} s`;
}

const upload = new UploadCanvas({ ask: () => { get("local-status").textContent = "Propuesta de demostración. No se envió ningún archivo."; }, cancel: () => { get("local-status").textContent = "Demostración cancelada."; } });
get("upload-stage").append(upload.el);
const hitButtons = upload.el.querySelectorAll("button"); hitButtons[0].textContent = "Propuesta local"; hitButtons[1].textContent = "Cancelar";
function uploadFrame() {
  const time = Number(get<HTMLInputElement>("upload-time").value), clock = new LocalClock();
  const hover = get<HTMLInputElement>("long-hover").checked ? 30 : .4;
  clock.scope(() => UploadSeq.enterZone(140, 90));
  let frame = clock.scope(() => UploadSeq.frame());
  for (let i = 1; i <= Math.ceil((hover + time) * 60); i++) {
    const seconds = i / 60;
    clock.advance(seconds * 1000, () => {
      if (seconds >= hover && !UploadSeq.dropped) UploadSeq.performDrop(2.4);
      if (!UploadSeq.dropped) UploadSeq.updateCursor(140 + Math.sin(i / 45) * 120, 90);
      frame = UploadSeq.frame();
    });
  }
  clock.scope(() => upload.draw(frame, clock.ms / 1000, preference()));
  get("upload-time-value").textContent = `${time.toFixed(2)} s + ${hover} s hover`;
}

for (const id of ["greeting-time", "interrupt"]) get(id).addEventListener("input", greeting);
for (const id of ["upload-time", "long-hover"]) get(id).addEventListener("input", uploadFrame);
for (const id of ["motion", "surface"]) get(id).addEventListener("change", () => { contactSheet(); greeting(); uploadFrame(); drawInteractive(); });
function drawInteractive() { ctx.clearRect(0, 0, 140, 140); interactiveClock.scope(() => bot.draw(ctx, 140, 140, preference())); }
let playing = false, raf = 0;
function animate() {
  raf = 0; if (!playing || document.hidden) return;
  interactiveClock.advance(interactiveClock.ms + 1000 / 60, () => bot.update(1 / 60)); drawInteractive();
  raf = requestAnimationFrame(animate);
}
function syncLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; if (playing && !document.hidden) raf = requestAnimationFrame(animate); }
get("play").addEventListener("click", () => { playing = !playing; get("play").textContent = playing ? "Pausar vista interactiva" : "Animar vista interactiva"; syncLoop(); });
document.addEventListener("visibilitychange", syncLoop);
contactSheet(); greeting(); uploadFrame(); drawInteractive();
document.documentElement.dataset.ready = "true";
