import { describe, expect, it } from 'vitest';
import { arrowMetrics, blockArrowPolygon, hitsBlockArrow, labelPose } from './arrowShape';

describe('pilform', () => {
  it('lar kropp og hode vokse med lengden, og stopper deretter', () => {
    const short = arrowMetrics(70);
    const mid = arrowMetrics(220);
    const huge = arrowMetrics(2000);
    expect(mid.shaft).toBeGreaterThan(short.shaft);
    expect(mid.headLen).toBeGreaterThan(short.headLen);
    expect(huge.shaft).toBe(arrowMetrics(800).shaft);
    expect(huge.headLen).toBeLessThanOrEqual(64);
    expect(huge.shaft).toBeLessThanOrEqual(34);
  });

  it('holder etiketten lesbar og over pilen', () => {
    const right = labelPose(0, 100, 200, 100, 20);
    expect(right.deg).toBe(0);
    expect(right.y).toBeLessThan(100);

    const left = labelPose(200, 80, 0, 80, 20);
    expect(left.deg).toBeGreaterThanOrEqual(-90);
    expect(left.deg).toBeLessThanOrEqual(90);
    expect(left.y).toBeLessThan(80);

    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const pose = labelPose(0, 0, Math.cos(rad) * 160, Math.sin(rad) * 160, 18);
      expect(pose.deg).toBeGreaterThanOrEqual(-90);
      expect(pose.deg).toBeLessThanOrEqual(90);
    }
  });

  it('treffer flaten på blokkpilen', () => {
    const polygon = blockArrowPolygon(0, 0, 180, 0);
    expect(polygon.length).toBeGreaterThan(4);
    expect(hitsBlockArrow(40, 0, 0, 0, 180, 0)).toBe(true);
    expect(hitsBlockArrow(40, 80, 0, 0, 180, 0)).toBe(false);
  });
});
