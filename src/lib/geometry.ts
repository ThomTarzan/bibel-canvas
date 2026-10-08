import type { ArrowStyle } from '../types';
import { BLOCK_H } from './layout';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArrowGeometry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
  curved: boolean;
  d: string;
  head: string;
  labelX: number;
  labelY: number;
}

export function blockRect(x: number, y: number, width: number): Rect {
  return { x, y, w: width, h: BLOCK_H };
}

export function boundsOf(rects: Rect[], pad: number): Rect | null {
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pointOnRectEdge(rect: Rect, towardX: number, towardY: number): { x: number; y: number } {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (dx === 0 && dy === 0) return { x: rect.x + rect.w, y: cy };
  const scaleX = dx !== 0 ? rect.w / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const scaleY = dy !== 0 ? rect.h / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function nudge(from: { x: number; y: number }, toward: { x: number; y: number }, distance: number) {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / length) * distance, y: from.y + (dy / length) * distance };
}

function headPath(x: number, y: number, angle: number): string {
  const length = 11;
  const spread = 5.5;
  const baseX = x - Math.cos(angle) * length;
  const baseY = y - Math.sin(angle) * length;
  const leftX = baseX + Math.cos(angle + Math.PI / 2) * spread;
  const leftY = baseY + Math.sin(angle + Math.PI / 2) * spread;
  const rightX = baseX + Math.cos(angle - Math.PI / 2) * spread;
  const rightY = baseY + Math.sin(angle - Math.PI / 2) * spread;
  return `M ${x} ${y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`;
}

function quadPoint(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, t: number) {
  const inv = 1 - t;
  return {
    x: inv * inv * x1 + 2 * inv * t * cx + t * t * x2,
    y: inv * inv * y1 + 2 * inv * t * cy + t * t * y2,
  };
}

export function arrowGeometry(from: Rect, to: Rect, style: ArrowStyle): ArrowGeometry | null {
  const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  if (Math.hypot(toCenter.x - fromCenter.x, toCenter.y - fromCenter.y) < 1) return null;

  const edgeStart = pointOnRectEdge(from, toCenter.x, toCenter.y);
  const edgeEnd = pointOnRectEdge(to, fromCenter.x, fromCenter.y);
  const start = nudge(edgeStart, edgeEnd, 3);
  const end = nudge(edgeEnd, edgeStart, 3);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const curved = style === 'curved';
  const bend = Math.min(42, length * 0.25);
  const cx = (start.x + end.x) / 2 + (-dy / length) * (curved ? bend : 0);
  const cy = (start.y + end.y) / 2 + (dx / length) * (curved ? bend : 0);
  const angle = curved ? Math.atan2(end.y - cy, end.x - cx) : Math.atan2(dy, dx);
  const mid = curved ? quadPoint(start.x, start.y, cx, cy, end.x, end.y, 0.5) : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const labelOffset = curved ? 0 : 14;

  return {
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    cx,
    cy,
    curved,
    d: curved ? `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}` : `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
    head: headPath(end.x, end.y, angle),
    labelX: mid.x + (-dy / length) * labelOffset,
    labelY: mid.y + (dx / length) * labelOffset,
  };
}

export function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function distanceToArrow(px: number, py: number, geom: ArrowGeometry): number {
  if (!geom.curved) return distanceToSegment(px, py, geom.x1, geom.y1, geom.x2, geom.y2);
  let min = Number.POSITIVE_INFINITY;
  let prevX = geom.x1;
  let prevY = geom.y1;
  for (let step = 1; step <= 16; step += 1) {
    const point = quadPoint(geom.x1, geom.y1, geom.cx, geom.cy, geom.x2, geom.y2, step / 16);
    min = Math.min(min, distanceToSegment(px, py, prevX, prevY, point.x, point.y));
    prevX = point.x;
    prevY = point.y;
  }
  return min;
}
