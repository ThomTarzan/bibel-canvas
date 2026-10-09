import type { ArrowEnd } from '../types';
import type { Point } from './arrowShape';
import { type Rect, pointOnRectEdge } from './geometry';

export interface SnapTarget {
  id: string;
  rect: Rect;
}

export interface MagnetHit {
  id: string;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

export function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.w));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}

export function nearestPointOnRect(point: Point, rect: Rect): Point {
  const inside = point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  if (!inside) {
    return {
      x: Math.min(rect.x + rect.w, Math.max(rect.x, point.x)),
      y: Math.min(rect.y + rect.h, Math.max(rect.y, point.y)),
    };
  }
  const left = point.x - rect.x;
  const right = rect.x + rect.w - point.x;
  const top = point.y - rect.y;
  const bottom = rect.y + rect.h - point.y;
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { x: rect.x, y: point.y };
  if (min === right) return { x: rect.x + rect.w, y: point.y };
  if (min === top) return { x: point.x, y: rect.y };
  return { x: point.x, y: rect.y + rect.h };
}

/** Nearest word, phrase or group within the threshold. A word inside a group wins over the group. */
export function findMagnet(point: Point, targets: SnapTarget[], threshold: number): MagnetHit | null {
  let best: { id: string; dist: number; area: number; rect: Rect } | null = null;
  for (const target of targets) {
    const dist = distanceToRect(point, target.rect);
    if (dist > threshold) continue;
    const area = target.rect.w * target.rect.h;
    // A word inside a group is smaller, so it wins when the pointer is near both.
    if (!best || area < best.area - 0.5 || (Math.abs(area - best.area) <= 0.5 && dist < best.dist)) {
      best = { id: target.id, dist, area, rect: target.rect };
    }
  }
  if (!best) return null;
  const snapped = nearestPointOnRect(point, best.rect);
  return {
    id: best.id,
    x: snapped.x,
    y: snapped.y,
    offsetX: snapped.x - best.rect.x,
    offsetY: snapped.y - best.rect.y,
  };
}

export function endFromMagnet(hit: MagnetHit | null, point: Point): ArrowEnd {
  if (!hit) return { x: point.x, y: point.y, targetId: null, edge: false };
  return { x: hit.offsetX, y: hit.offsetY, targetId: hit.id, edge: false };
}

export function resolveEnd(end: ArrowEnd, rect: Rect | null, toward: Point): Point {
  if (!end.targetId || !rect) return { x: end.x, y: end.y };
  if (end.edge) return pointOnRectEdge(rect, toward.x, toward.y);
  return { x: rect.x + end.x, y: rect.y + end.y };
}

export function resolveEnds(
  from: ArrowEnd,
  to: ArrowEnd,
  fromRect: Rect | null,
  toRect: Rect | null,
): { a: Point; b: Point } {
  const fromFallback = fromRect ? { x: fromRect.x + fromRect.w / 2, y: fromRect.y + fromRect.h / 2 } : { x: from.x, y: from.y };
  const toFallback = toRect ? { x: toRect.x + toRect.w / 2, y: toRect.y + toRect.h / 2 } : { x: to.x, y: to.y };
  let a = resolveEnd(from, fromRect, toFallback);
  let b = resolveEnd(to, toRect, fromFallback);
  a = resolveEnd(from, fromRect, b);
  b = resolveEnd(to, toRect, a);
  return { a, b };
}
