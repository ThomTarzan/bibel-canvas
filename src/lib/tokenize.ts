/**
 * Word tokenizer for Latin-script Bible text.
 * Punctuation stays on the preceding word. Opening quotes and "(" stay on the next word.
 * Newlines are not tokens; they become row breaks.
 */

const OPENING = new Set(['«', '"', '“', '‘', '(', '[', '‹']);

function isOpeningChar(ch: string): boolean {
  return OPENING.has(ch);
}

function isTrailingChar(ch: string): boolean {
  return /[.,;:!?…%»”’")\]›–—-]/.test(ch);
}

function isLetter(ch: string): boolean {
  return /\p{L}/u.test(ch);
}

function isDigitish(ch: string): boolean {
  return /[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(ch);
}

function isBodyChar(line: string, index: number, tokenSoFar: string): boolean {
  const ch = line[index];
  if (isLetter(ch) || isDigitish(ch)) return true;

  const prev = tokenSoFar[tokenSoFar.length - 1];
  const next = line[index + 1];
  if (!prev || !next) return false;

  const prevDigit = isDigitish(prev);
  const nextDigit = isDigitish(next);
  const prevLetter = isLetter(prev);
  const nextLetter = isLetter(next);

  // 8:1, 8,1, 144.000, 1–4, 8:1–4
  if (prevDigit && nextDigit && (ch === ':' || ch === ',' || ch === '.' || ch === '-' || ch === '–' || ch === '—')) {
    return true;
  }
  // ord-for-ord, don't
  if (prevLetter && nextLetter && (ch === '-' || ch === "'" || ch === '’')) {
    return true;
  }
  return false;
}

function isOnlyOpening(token: string): boolean {
  return token.length > 0 && [...token].every((ch) => isOpeningChar(ch));
}

function hasWordish(token: string): boolean {
  return /[\p{L}\p{N}⁰¹²³⁴⁵⁶⁷⁸⁹]/u.test(token);
}

/** Tokenize a single line. Spaces separate words; they are not tokens. */
export function tokenizeLine(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const n = line.length;

  while (i < n) {
    while (i < n && (line[i] === ' ' || line[i] === '\t')) i += 1;
    if (i >= n) break;

    const start = i;
    let token = '';

    while (i < n && isOpeningChar(line[i]) && !hasWordish(token)) {
      token += line[i];
      i += 1;
    }

    while (i < n && isBodyChar(line, i, token)) {
      token += line[i];
      i += 1;
    }

    while (i < n && isTrailingChar(line[i])) {
      token += line[i];
      i += 1;
    }

    if (i === start) {
      i += 1;
      continue;
    }

    if (!hasWordish(token) && !isOnlyOpening(token) && tokens.length > 0) {
      tokens[tokens.length - 1] += token;
      continue;
    }

    tokens.push(token);
  }

  const merged: string[] = [];
  for (const token of tokens) {
    if (isOnlyOpening(token) && merged.length === 0) {
      merged.push(token);
      continue;
    }
    if (isOnlyOpening(token)) {
      continue;
    }
    if (merged.length > 0 && isOnlyOpening(merged[merged.length - 1])) {
      merged[merged.length - 1] += token;
    } else {
      merged.push(token);
    }
  }

  // A dangling opening mark at the end has nothing to attach to.
  return merged.filter((token) => hasWordish(token) || !isOnlyOpening(token));
}

export interface RawRow {
  tokens: string[];
}

/** Split a passage into rows. Blank lines are kept as empty rows. */
export function tokenizePassage(text: string): RawRow[] {
  const normalized = text
    .replace(/^\uFEFF/, '')
    .replace(/\u00A0|\u202F|\u2009|\u2007/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00AD/g, '');

  if (normalized.trim() === '') return [];

  return normalized.split('\n').map((line) => ({ tokens: tokenizeLine(line) }));
}
