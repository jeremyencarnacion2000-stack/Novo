import { installFakeDom } from '../fakedom.mjs';
import { createRecordingCanvas, RecordingPath } from './recording-canvas.mjs';
import { calls, internals } from '../tauri.mjs';

// Runs the actual island lifecycle, not a second renderer. Only host facilities
// (DOM, clock, Rust boot/preferences) are controlled. Native pixels remain a
// separate acceptance check: this records commands, not WebView2 compositing.
export async function replayStartup({prefs, bootOrder, framesMs, dpiScale}) {
  const keys = ['document', 'performance', 'Path2D', 'requestAnimationFrame', 'cancelAnimationFrame',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'addEventListener', 'devicePixelRatio'];
  const descriptors = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const originalInvoke = internals.invoke;
  const originalMetadata = internals.metadata;
  internals.metadata = {currentWindow:{label:'island'}, currentWebview:{label:'island'}};
  let now = 0, nextId = 0;
  const raf = new Map(), timers = new Map(), canvases = [];
  const dom = installFakeDom(), createElement = document.createElement;
  const define = (key, value) => Object.defineProperty(globalThis, key, {value, writable:true, configurable:true});
  define('performance', {now: () => now});
  define('Path2D', RecordingPath);
  define('devicePixelRatio', dpiScale);
  define('requestAnimationFrame', fn => {const id = ++nextId; raf.set(id, fn); return id;});
  define('cancelAnimationFrame', id => raf.delete(id));
  define('setTimeout', (fn, ms = 0) => {const id = ++nextId; timers.set(id, {fn, due:now + ms}); return id;});
  define('clearTimeout', id => timers.delete(id));
  define('setInterval', (fn, ms) => {const id = ++nextId; timers.set(id, {fn, due:now + ms, interval:ms}); return id;});
  define('clearInterval', id => timers.delete(id));
  define('addEventListener', () => {});
  document.createElement = tag => {
    const el = createElement(tag);
    Object.defineProperty(el, 'lastElementChild', {get: () => el.children.at(-1) ?? null});
    Object.defineProperty(el, 'isConnected', {get() {
      let node = el;
      while (node) {if (node === document.body) return true; node = node.parentNode;}
      return false;
    }});
    if (tag === 'canvas') {
      const recording = createRecordingCanvas();
      el.width = 300; el.height = 150;
      el.getContext = () => recording.ctx;
      canvases.push({el, ...recording});
    }
    return el;
  };
  const { State, DEFAULT_SETTINGS } = await import('../../src/core/state.ts');
  const savedState = {...State};
  Object.assign(State, new State.constructor());
  const { Bridge } = await import('../../src/core/bridge.ts');
  const { miniBotCount, releaseMiniBot } = await import('../../src/mochi/minibots.ts');
  let island;
  try {
    const settings = {...DEFAULT_SETTINGS, soundEnabled:false, desktopMochi:{onDesktop:prefs.onDesktop, spot:null},
      ...(prefs.existing ? {mainPill:'agent_codex', activeIntegrations:['integration_github', 'integration_vercel']} : {})};
    internals.invoke = async (cmd, args) => {
      if (cmd === 'boot') return {settings, screen:{x:0,y:0,width:1920,height:1080,scale:dpiScale},
        version:'fixture', hookPath:'', cursorPoll:true};
      if (cmd === 'desktop_mochi_info') return {mode:'poll', onDesktop:prefs.onDesktop};
      if (cmd === 'desktop_mochi_fly_out') return true;
      return originalInvoke(cmd, args);
    };
    const { Island } = await import('../../src/island/island.ts');
    const root = dom.root(); document.body.append(root);
    island = new Island(root);
    const tick = async time => {
      now = time;
      for (const [id, timer] of [...timers]) if (timer.due <= now) {
        timers.delete(id); timer.fn();
        if (timer.interval) timers.set(id, {...timer, due:now + timer.interval});
      }
      const callbacks = [...raf.values()]; raf.clear();
      for (const fn of callbacks) fn(now);
      // Settle the real desktop controller's async bridge calls before sampling.
      await Promise.resolve(); await Promise.resolve();
    };
    if (bootOrder === 'delayed') {await tick(16); await tick(32);}
    const boot = await Bridge.boot();
    State.settings = {...State.settings, ...boot.settings};
    island.applySettings(); State.loadIntegrationTasks();
    await island.desktop.init(); island.launch();
    now = 0;
    const frames = [];
    let interrupted = false;
    for (const sample of framesMs) {
      while (now < sample) {
        await tick(Math.min(sample, now + 16));
        if (bootOrder === 'interrupted' && !interrupted && now >= 250) {
          island.fsm.mouseLeft(); interrupted = true;
        }
      }
      await tick(sample);
      const surfaces = canvases.filter(c => c.el.isConnected).map(c => ({
        id:c.el.getAttribute('id') ?? 'mini', operations:c.commands.length,
        width:c.el.width, height:c.el.height,
      }));
      frames.push({time:sample, surfaces, miniatures:miniBotCount(),
        mainCharacterRegistered:surfaces.some(s => s.id === 'bot-canvas') && surfaces.some(s => s.id === 'greeting-canvas'),
        home:State.mochiOnDesktop ? 'desktop' : 'island',
        numericArguments:[...surfaces.flatMap(s => [s.width, s.height]),
          ...canvases.flatMap(c => c.commands.flatMap(command => command.args.filter(v => typeof v === 'number')))],
      });
    }
    return {frames, ready:!!boot};
  } finally {
    island?.fsm.cancelTimers();
    for (const canvas of canvases) releaseMiniBot(canvas.el);
    Object.assign(State, savedState);
    internals.invoke = originalInvoke;
    internals.metadata = originalMetadata;
    calls.length = 0;
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}
