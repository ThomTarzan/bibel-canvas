import { describe, expect, it } from 'vitest';
import { findMagnet, resolveEnd } from './snap';

describe('magnetiske ender', () => {
  const word = { id: 'ord', rect: { x: 100, y: 40, w: 50, h: 34 } };
  const group = { id: 'gruppe', rect: { x: 80, y: 20, w: 120, h: 80 } };

  it('fester seg nær et ord og lar ordet vinne over gruppen', () => {
    const near = findMagnet({ x: 96, y: 50 }, [group, word], 26);
    expect(near?.id).toBe('ord');
    expect(near && near.x).toBeGreaterThanOrEqual(word.rect.x);
    expect(near && near.y).toBeGreaterThanOrEqual(word.rect.y);

    const far = findMagnet({ x: 10, y: 10 }, [word], 26);
    expect(far).toBeNull();
  });

  it('følger brikken når enden er festet', () => {
    const end = { x: 8, y: 12, targetId: 'ord', edge: false };
    const first = resolveEnd(end, { x: 100, y: 40, w: 50, h: 34 }, { x: 0, y: 0 });
    const moved = resolveEnd(end, { x: 140, y: 70, w: 50, h: 34 }, { x: 0, y: 0 });
    expect(moved.x - first.x).toBe(40);
    expect(moved.y - first.y).toBe(30);
  });

  it('blir stående der den ble sluppet når den ikke er festet', () => {
    const end = { x: 15, y: 25, targetId: null, edge: false };
    expect(resolveEnd(end, { x: 100, y: 40, w: 50, h: 34 }, { x: 0, y: 0 })).toEqual({ x: 15, y: 25 });
  });
});
