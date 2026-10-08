import { describe, expect, it } from 'vitest';
import { analyzeText } from './classify';
import { BLOCK_H, ROW_GAP, START_Y, layoutAnalysis } from './layout';

const GLUED = `1Så er det nåde.
2For loven er ånd.`;

describe('layoutAnalysis', () => {
  it('legger neste linje på en ny rad', () => {
    const laid = layoutAnalysis(analyzeText('Alfa beta\nGamma'), { includeVerseNumbers: false });
    expect(laid.map((block) => block.text)).toEqual(['Alfa', 'beta', 'Gamma']);
    expect(laid[0]?.y).toBe(START_Y);
    expect(laid[2]?.y).toBe(START_Y + BLOCK_H + ROW_GAP);
    expect(laid[1]?.x).toBeGreaterThan(laid[0]?.x ?? 0);
  });

  it('utelater versnumre i vanlig oppsett og tar dem med når man angrer', () => {
    const analysis = analyzeText(GLUED);
    const visible = layoutAnalysis(analysis, { includeVerseNumbers: false });
    const all = layoutAnalysis(analysis, { includeVerseNumbers: true });
    expect(visible[0]?.text).toBe('Så');
    expect(visible.some((block) => block.text === '1')).toBe(false);
    expect(all[0]?.text).toBe('1');
    expect(all[0]?.kind).toBe('number');
    expect(all[1]?.text).toBe('Så');
    expect(all[1]?.x).toBeGreaterThan(all[0]?.x ?? 0);
  });
});
