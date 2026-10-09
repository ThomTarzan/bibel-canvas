import type { Analysis } from './classify';

export const GRID = 24;
export const BLOCK_H = 34;
export const WORD_GAP = 8;
export const ROW_GAP = 18;
export const START_X = 220;
export const START_Y = 156;
export const BLOCK_PAD_X = 22;

export interface DraftBlock {
  text: string;
  x: number;
  y: number;
  kind: 'word' | 'number';
  uncertain: boolean;
}

/** Width estimate used in Node tests and before a canvas measure exists. */
export function estimateWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    if (ch === ' ') width += 4.4;
    else if ('iljI.,:;!|\'’'.includes(ch)) width += 4.3;
    else if ('mwMWÆØÅæøå«»"'.includes(ch)) width += 12.4;
    else width += 8.7;
  }
  return Math.max(28, Math.ceil(width + BLOCK_PAD_X));
}

export function layoutAnalysis(
  analysis: Analysis,
  options: { includeVerseNumbers: boolean; measure?: (text: string) => number },
): DraftBlock[] {
  const measure = options.measure ?? estimateWidth;
  const blocks: DraftBlock[] = [];
  let y = START_Y;

  for (const row of analysis.rows) {
    const tokens = row.tokens.filter((token) => options.includeVerseNumbers || token.role !== 'verse-number');
    if (tokens.length === 0) {
      y += ROW_GAP;
      continue;
    }
    let x = START_X;
    for (const token of tokens) {
      blocks.push({
        text: token.text,
        x,
        y,
        kind: token.role === 'word' ? 'word' : 'number',
        uncertain: token.role === 'uncertain-number',
      });
      x += measure(token.text) + WORD_GAP;
    }
    y += BLOCK_H + ROW_GAP;
  }

  return blocks;
}
