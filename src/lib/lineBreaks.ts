import type { LineBreakSettings } from '../types';

/** Punctuation that may start a new row after the word it belongs to. */
export type BreakKey = keyof LineBreakSettings;

export const BREAK_MARKS: { key: BreakKey; label: string }[] = [
  { key: 'period', label: 'Punktum (.)' },
  { key: 'comma', label: 'Komma (,)' },
  { key: 'question', label: 'Spørsmålstegn (?)' },
  { key: 'exclamation', label: 'Utropstegn (!)' },
  { key: 'semicolon', label: 'Semikolon (;)' },
  { key: 'colon', label: 'Kolon (:)' },
];

export const DEFAULT_LINE_BREAKS: LineBreakSettings = {
  period: true,
  comma: true,
  question: true,
  exclamation: true,
  semicolon: true,
  colon: true,
};

const CHAR_TO_KEY: Record<string, BreakKey> = {
  '.': 'period',
  ',': 'comma',
  ';': 'semicolon',
  ':': 'colon',
  '?': 'question',
  '!': 'exclamation',
};

/** Closing quotes and brackets sit after the punctuation and do not hide it. */
const CLOSERS = /[»”"’)\]›']+$/u;

export function normalizeLineBreaks(value: unknown): LineBreakSettings {
  const next = { ...DEFAULT_LINE_BREAKS };
  if (!value || typeof value !== 'object') return next;
  const record = value as Record<string, unknown>;
  for (const mark of BREAK_MARKS) {
    const flag = record[mark.key];
    if (typeof flag === 'boolean') next[mark.key] = flag;
  }
  return next;
}

/**
 * The break character at the end of a token, after closing quotes.
 * A comma inside 8,1 or a colon inside 8:1 is not at the end, so it does not match.
 */
export function tokenBreakKey(text: string): BreakKey | null {
  const stripped = text.replace(CLOSERS, '');
  const last = stripped.at(-1) ?? '';
  return CHAR_TO_KEY[last] ?? null;
}

/** Split one user row into visual rows. The user's own row boundaries stay outside this function. */
export function splitTokenLines<T extends { text: string }>(tokens: T[], settings: LineBreakSettings): T[][] {
  if (tokens.length === 0) return [];
  const lines: T[][] = [[]];
  tokens.forEach((token, index) => {
    lines[lines.length - 1].push(token);
    const key = tokenBreakKey(token.text);
    if (index < tokens.length - 1 && key && settings[key]) lines.push([]);
  });
  return lines;
}
