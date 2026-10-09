import { describe, expect, it } from 'vitest';
import { placePopover, type Box } from './placePopover';

const DESKTOP = { width: 1280, height: 800 };

function overlaps(anchor: Box, left: number, top: number, width: number, height: number): boolean {
  return left < anchor.left + anchor.width && left + width > anchor.left && top < anchor.top + anchor.height && top + height > anchor.top;
}

function inside(left: number, top: number, width: number, height: number, viewport = DESKTOP): boolean {
  return left >= 12 && top >= 12 && left + width <= viewport.width - 12 && top + height <= viewport.height - 12;
}

describe('placePopover', () => {
  it('åpner verktøylinjen nedover og holder menyen innenfor 1280x800', () => {
    const anchor = { left: 980, top: 18, width: 88, height: 32 };
    const placement = placePopover({
      anchor,
      size: { width: 260, height: 240 },
      viewport: DESKTOP,
      prefer: 'below',
    });
    expect(placement.top).toBeGreaterThanOrEqual(anchor.top + anchor.height);
    expect(inside(placement.left, placement.top, 260, 240)).toBe(true);
    expect(overlaps(anchor, placement.left, placement.top, 260, 240)).toBe(false);
  });

  it('skyver en meny inn fra høyre og venstre kant', () => {
    const right = placePopover({
      anchor: { left: 1180, top: 18, width: 80, height: 32 },
      size: { width: 260, height: 180 },
      viewport: DESKTOP,
      prefer: 'below',
    });
    expect(inside(right.left, right.top, 260, 180)).toBe(true);

    const left = placePopover({
      anchor: { left: 4, top: 18, width: 70, height: 32 },
      size: { width: 260, height: 180 },
      viewport: DESKTOP,
      prefer: 'below',
    });
    expect(inside(left.left, left.top, 260, 180)).toBe(true);
    expect(left.top).toBeGreaterThanOrEqual(18 + 32);
  });

  it('åpner en bunnmeny oppover når det ikke er plass under', () => {
    const anchor = { left: 560, top: 740, width: 72, height: 40 };
    const placement = placePopover({
      anchor,
      size: { width: 248, height: 220 },
      viewport: DESKTOP,
      prefer: 'below',
    });
    expect(placement.top + 220).toBeLessThanOrEqual(anchor.top);
    expect(inside(placement.left, placement.top, 248, 220)).toBe(true);
    expect(overlaps(anchor, placement.left, placement.top, 248, 220)).toBe(false);
  });

  it('legger fargevelgeren under ordet så ordet blir synlig', () => {
    const anchor = { left: 420, top: 180, width: 70, height: 34 };
    const placement = placePopover({
      anchor,
      size: { width: 248, height: 190 },
      viewport: DESKTOP,
      prefer: 'around',
    });
    expect(placement.top).toBeGreaterThanOrEqual(anchor.top + anchor.height);
    expect(inside(placement.left, placement.top, 248, 190)).toBe(true);
    expect(overlaps(anchor, placement.left, placement.top, 248, 190)).toBe(false);
  });

  it('flytter fargevelgeren over ordet nær bunnen', () => {
    const anchor = { left: 420, top: 730, width: 70, height: 34 };
    const placement = placePopover({
      anchor,
      size: { width: 248, height: 190 },
      viewport: DESKTOP,
      prefer: 'around',
    });
    expect(placement.top + 190).toBeLessThanOrEqual(anchor.top);
    expect(overlaps(anchor, placement.left, placement.top, 248, 190)).toBe(false);
  });

  it('legger fargevelgeren ved siden av ordet når det ikke er plass over eller under', () => {
    const viewport = { width: 420, height: 240 };
    const anchor = { left: 300, top: 100, width: 80, height: 34 };
    const placement = placePopover({
      anchor,
      size: { width: 248, height: 180 },
      viewport,
      prefer: 'around',
    });
    const width = Math.min(248, placement.maxWidth);
    const height = Math.min(180, placement.maxHeight);
    expect(inside(placement.left, placement.top, width, height, viewport)).toBe(true);
    expect(overlaps(anchor, placement.left, placement.top, width, height)).toBe(false);
    expect(placement.left + width).toBeLessThanOrEqual(anchor.left);
  });

  it('holder en meny innenfor et smalt vindu', () => {
    const viewport = { width: 360, height: 700 };
    const placement = placePopover({
      anchor: { left: 250, top: 70, width: 90, height: 32 },
      size: { width: 248, height: 300 },
      viewport,
      prefer: 'below',
    });
    expect(inside(placement.left, placement.top, 248, 300, viewport)).toBe(true);
    expect(placement.top).toBeGreaterThanOrEqual(70 + 32);
  });
});
