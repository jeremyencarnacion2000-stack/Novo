import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

export const STATES = ['idle', 'working', 'thinking', 'searching', 'approval', 'question', 'error', 'finished', 'ratelimit', 'sleeping', 'dizzy'];
export const EMOTES = ['love', 'surprised', 'proud', 'wink', 'yawn', 'happy', 'annoyed'];
export const SCENARIOS = [
  ...STATES.map(s => `state:${s}`), ...EMOTES.map(s => `emote:${s}`),
  'blink', 'squash', 'gulp', 'slap', 'roll', 'greet', 'greet-interrupt', 'cursor', 'morph',
  'greeting', 'greeting-interrupt', 'upload-drop', 'upload-hover-long',
];
const run = promisify(execFile);

export async function sampleMotion(revision, scenario) {
  if (!['upstream', 'working'].includes(revision) || !SCENARIOS.includes(scenario)) throw new Error('Unknown motion scenario');
  const { stdout } = await run(process.execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', new URL('../setup.mjs', import.meta.url).href,
    fileURLToPath(import.meta.url), '--sample', revision, scenario], { maxBuffer: 4 * 1024 * 1024 });
  return JSON.parse(stdout);
}

function flatten(value) {
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item === 'object') {
      for (const [child, v] of Object.entries(item)) result[key + child[0].toUpperCase() + child.slice(1)] = v;
    } else result[key] = item;
  }
  return result;
}

async function collect(revision, scenario) {
  let ms = 0, nextId = 0;
  const timers = new Map();
  const saved = { performance: globalThis.performance, random: Math.random, setTimeout, clearTimeout };
  globalThis.performance = { now: () => ms };
  Math.random = () => 0.425;
  globalThis.setTimeout = (fn, delay = 0) => { const id = ++nextId; timers.set(id, { at: ms + delay, fn }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  let hook;
  try {
    if (revision === 'upstream') hook = (await import('./motion-reference-loader.mjs')).installReferenceLoader();
    const { Sound } = await import('../../src/core/sound.ts');
    Sound.enabled = false;
    const { BotEngine } = await import('../../src/mochi/engine.ts');
    const { greetingPose } = await import('../../src/mochi/greeting.ts');
    const { UploadSeq } = await import('../../src/upload/sequence.ts');
    const bot = new BotEngine();
    bot.onDizzy = () => bot.setState('dizzy');
    if (scenario.startsWith('state:')) bot.setState(scenario.slice(6), true);
    else if (scenario.startsWith('emote:')) bot.triggerEmote(scenario.slice(6));
    else if (scenario === 'roll') bot.doRoll(950, 1);
    else if (scenario === 'greet-interrupt') { bot.greet(); setTimeout(() => bot.interruptGreet(), 800); }
    else if (scenario === 'slap') { bot.slap(); setTimeout(() => bot.slap(), 300); setTimeout(() => bot.slap(), 600); }
    else if (scenario === 'morph') { bot.animateMorph(1); setTimeout(() => bot.gulp(), 600); setTimeout(() => bot.animateMorph(0), 2600); }
    else if (['blink', 'squash', 'gulp', 'greet'].includes(scenario)) bot[scenario]();
    if (scenario.startsWith('upload')) {
      UploadSeq.enterZone(140, 90);
      if (scenario === 'upload-drop') setTimeout(() => UploadSeq.performDrop(2.4), 400);
    }
    const samples = [], seconds = scenario === 'upload-hover-long' ? 30 : 6;
    for (let frame = 0; frame <= seconds * 60; frame++) {
      ms = frame * 1000 / 60;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= ms).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        timers.delete(due[0]); due[1].fn();
      }
      let pose;
      if (scenario.startsWith('greeting')) pose = greetingPose(frame / 60, scenario.endsWith('interrupt') ? 1.6 : Infinity);
      else if (scenario.startsWith('upload')) {
        if (!UploadSeq.dropped) UploadSeq.updateCursor(140 + Math.sin(frame / 45) * 120, 90);
        pose = flatten(UploadSeq.frame());
      } else {
        if (scenario === 'cursor') { bot.lookX = Math.sin(frame / 35); bot.lookY = Math.cos(frame / 40); }
        bot.update(1 / 60);
        pose = Object.fromEntries(['state', 'eyeOverride', 'yaw', 'pitch', 'roll', 'tilt', 'open', 'sx', 'sy', 'oy', 'ox', 'morph', 'hands', 'es', 'badgeS', 'slotH'].map(k => [k, bot[k]]));
        pose.badgeKind = bot.badge?.kind ?? null;
      }
      samples.push({ frame, pose });
    }
    return samples;
  } finally {
    hook?.deregister();
    globalThis.performance = saved.performance;
    Math.random = saved.random;
    globalThis.setTimeout = saved.setTimeout;
    globalThis.clearTimeout = saved.clearTimeout;
  }
}

if (process.argv[2] === '--sample') process.stdout.write(JSON.stringify(await collect(process.argv[3], process.argv[4])));
