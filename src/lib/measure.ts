import type { TextFont } from './fonts';
import { DEFAULT_FONT, fontCss } from './fonts';
import { BLOCK_PAD_X, estimateWidth } from './layout';

const cache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null | undefined;

function estimateFor(text: string, font: TextFont): number {
  const weight = font.weight >= 600 ? 1.05 : 1;
  const family = font.family === 'neutral' ? 0.96 : 1;
  const raw = estimateWidth(text);
  const scaled = (raw - BLOCK_PAD_X) * (font.size / 17) * weight * family + BLOCK_PAD_X;
  return Math.max(28, Math.ceil(scaled));
}

export function measureTextWidth(text: string, font: TextFont = DEFAULT_FONT): number {
  const key = `${font.family}|${font.weight}|${font.size}|${text}`;
  const cached = cache.get(key);
  if (cached != null) return cached;

  let width = estimateFor(text, font);
  if (typeof document !== 'undefined') {
    if (ctx === undefined) {
      const canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
    }
    if (ctx) {
      ctx.font = fontCss(font);
      width = Math.max(28, Math.ceil(ctx.measureText(text).width) + BLOCK_PAD_X);
    }
  }

  cache.set(key, width);
  return width;
}

export function clearMeasureCache(): void {
  cache.clear();
}
