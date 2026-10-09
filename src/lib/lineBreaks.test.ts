import { describe, expect, it } from 'vitest';
import { analyzeText } from './classify';
import { BLOCK_H, ROW_GAP, START_Y, layoutAnalysis } from './layout';
import { DEFAULT_LINE_BREAKS, splitTokenLines, tokenBreakKey } from './lineBreaks';
import type { LineBreakSettings } from '../types';

const OFF: LineBreakSettings = {
  period: false,
  comma: false,
  semicolon: false,
  colon: false,
  question: false,
  exclamation: false,
};

function words(text: string) {
  return text.split(' ').map((token) => ({ text: token }));
}

describe('tokenBreakKey', () => {
  it('ser tegnet på slutten av ordet, også bak anførsel', () => {
    expect(tokenBreakKey('lov,')).toBe('comma');
    expect(tokenBreakKey('nåde.')).toBe('period');
    expect(tokenBreakKey('hit.»')).toBe('period');
    expect(tokenBreakKey('(nå).')).toBe('period');
    expect(tokenBreakKey('Hvem?')).toBe('question');
    expect(tokenBreakKey('Se!')).toBe('exclamation');
    expect(tokenBreakKey('der;')).toBe('semicolon');
    expect(tokenBreakKey('sa:')).toBe('colon');
  });

  it('lar komma og kolon inni tall være i fred', () => {
    expect(tokenBreakKey('8,1')).toBeNull();
    expect(tokenBreakKey('8:1')).toBeNull();
    expect(tokenBreakKey('8:1–4')).toBeNull();
    expect(tokenBreakKey('144.000')).toBeNull();
    expect(tokenBreakKey('Jesus')).toBeNull();
  });
});

describe('splitTokenLines', () => {
  it('bryter etter valgt tegn og lar tegnet bli på ordet', () => {
    const lines = splitTokenLines(words('Alfa beta, gamma. delta'), DEFAULT_LINE_BREAKS);
    expect(lines.map((line) => line.map((token) => token.text))).toEqual([['Alfa', 'beta,'], ['gamma.'], ['delta']]);
  });

  it('lager ikke en tom rad etter siste ord', () => {
    const lines = splitTokenLines(words('Alfa beta.'), DEFAULT_LINE_BREAKS);
    expect(lines.map((line) => line.map((token) => token.text))).toEqual([['Alfa', 'beta.']]);
  });

  it('bryter bare på tegnene som er slått på', () => {
    const commaOnly: LineBreakSettings = { ...OFF, comma: true };
    const lines = splitTokenLines(words('Alfa, beta. gamma? delta: epsilon; zeta!'), commaOnly);
    expect(lines.map((line) => line.map((token) => token.text))).toEqual([
      ['Alfa,'],
      ['beta.', 'gamma?', 'delta:', 'epsilon;', 'zeta!'],
    ]);
  });

  it('kan slå av alle tegn', () => {
    const lines = splitTokenLines(words('Alfa, beta. gamma'), OFF);
    expect(lines).toHaveLength(1);
  });

  it('behandler spørsmål, utrop, semikolon og kolon hver for seg', () => {
    const text = words('Hvem? Se! der; sa: neste');
    expect(splitTokenLines(text, { ...OFF, question: true }).map((line) => line.map((token) => token.text))).toEqual([
      ['Hvem?'],
      ['Se!', 'der;', 'sa:', 'neste'],
    ]);
    expect(splitTokenLines(text, { ...OFF, exclamation: true }).map((line) => line.map((token) => token.text))).toEqual([
      ['Hvem?', 'Se!'],
      ['der;', 'sa:', 'neste'],
    ]);
    expect(splitTokenLines(text, { ...OFF, semicolon: true }).map((line) => line.map((token) => token.text))).toEqual([
      ['Hvem?', 'Se!', 'der;'],
      ['sa:', 'neste'],
    ]);
    expect(splitTokenLines(text, { ...OFF, colon: true }).map((line) => line.map((token) => token.text))).toEqual([
      ['Hvem?', 'Se!', 'der;', 'sa:'],
      ['neste'],
    ]);
  });
});

describe('layoutAnalysis med linjeskift', () => {
  it('beholder brukerens linjeskift og bryter i tillegg på tegn', () => {
    const laid = layoutAnalysis(analyzeText('Alfa, beta\nGamma delta.'), {
      includeVerseNumbers: false,
      lineBreaks: DEFAULT_LINE_BREAKS,
    });
    expect(laid.map((block) => block.text)).toEqual(['Alfa,', 'beta', 'Gamma', 'delta.']);
    expect(laid[0]?.y).toBe(START_Y);
    expect(laid[1]?.y).toBe(START_Y + BLOCK_H + ROW_GAP);
    expect(laid[2]?.y).toBe(START_Y + 2 * (BLOCK_H + ROW_GAP));
    expect(laid[3]?.y).toBe(laid[2]?.y);
  });

  it('lar en lang setning ligge på én rad når tegnsetting er slått av', () => {
    const laid = layoutAnalysis(analyzeText('Alfa, beta. gamma'), {
      includeVerseNumbers: false,
      lineBreaks: OFF,
    });
    expect(laid.map((block) => block.y)).toEqual([START_Y, START_Y, START_Y]);
  });
});
