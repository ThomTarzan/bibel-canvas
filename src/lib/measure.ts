import { BLOCK_PAD_X, estimateWidth } from './layout';

const cache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null | undefined;

const FONT = '400 17px "Source Serif 4", Palatino, "Palatino Linotype", Georgia, serif';

export function measureTextWidth(text: string): number {
  const cached = cache.get(text);
  if (cached != null) return cached;

  let width = estimateWidth(text);
  if (typeof document !== 'undefined') {
    if (ctx === undefined) {
      const canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
    }
    if (ctx) {
      ctx.font = FONT;
      width = Math.max(28, Math.ceil(ctx.measureText(text).width) + BLOCK_PAD_X);
    }
  }

  cache.set(text, width);
  return width;
}

export function clearMeasureCache(): void {
  cache.clear();
}
