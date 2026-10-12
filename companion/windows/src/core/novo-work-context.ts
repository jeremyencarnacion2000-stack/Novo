export interface NovoWorkContextInput {
  projectLabel: string | null;
  focusSummary: string;
}

const unsafeText = [
  /https?:\/\/|\bwww\./i,
  /(?:^|\s)[a-z]:\\|\\\\|(?:^|\s)~?\/(?:users|home|workspace|workspaces|private|var|etc)(?:\/|\b)/i,
  /\b(?:api[_ -]?key|access[_ -]?token|password|passwd|secret|bearer)\s*[:=]/i,
  /[\u0000-\u001f\u007f]/,
];

function isSafe(value: string): boolean {
  return !unsafeText.some((pattern) => pattern.test(value));
}

/** Only normalizes the note the user typed; never derives text from app/window data. */
export function normalizeNovoWorkContextInput(projectLabel: string, focusSummary: string): NovoWorkContextInput | null {
  const project = projectLabel.trim();
  const focus = focusSummary.trim();
  if (!focus || Array.from(focus).length > 240 || Array.from(project).length > 100) return null;
  if (!isSafe(project) || !isSafe(focus)) return null;
  return { projectLabel: project || null, focusSummary: focus.replace(/ {2,}/g, ' ') };
}
