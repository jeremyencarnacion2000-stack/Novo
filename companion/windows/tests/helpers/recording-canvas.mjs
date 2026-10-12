export class RecordingPath {
  commands = [];
  constructor() { return new Proxy(this, { get: (target, key) => key in target ? target[key] : (...args) => target.commands.push({ op: key, args }) }); }
}

export function createRecordingCanvas() {
  const commands = [], stack = [], state = { globalAlpha: 1 };
  const ctx = new Proxy(state, {
    set(target, key, value) { target[key] = value; commands.push({ op: String(key), args: [value] }); return true; },
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        commands.push({ op: String(key), args });
        if (key === 'save') stack.push({ ...target });
        if (key === 'restore') { if (!stack.length) throw new Error('unbalanced restore'); Object.assign(target, stack.pop()); }
        if (String(key).startsWith('create') && String(key).endsWith('Gradient')) return { addColorStop: (...values) => commands.push({ op: 'addColorStop', args: values }) };
        if (key === 'measureText') return { width: String(args[0]).length * 7 };
      };
    },
  });
  return { ctx, commands };
}
