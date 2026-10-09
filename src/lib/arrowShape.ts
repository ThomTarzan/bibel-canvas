export interface Point {
  x: number;
  y: number;
}

export interface ArrowMetrics {
  shaft: number;
  headLen: number;
  headWidth: number;
  shaftEnd: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Thickness and head grow with the arrow, then stop growing. */
export function arrowMetrics(length: number): ArrowMetrics {
  const safe = Math.max(length, 1);
  const shaft = clamp(safe * 0.16, 16, 34);
  const headLen = Math.min(clamp(safe * 0.32, 26, 64), safe * 0.48);
  const headWidth = clamp(shaft * 2.05, 34, 76);
  return { shaft, headLen, headWidth, shaftEnd: Math.max(safe - headLen, safe * 0.42) };
}

export function blockArrowPolygon(x1: number, y1: number, x2: number, y2: number): Point[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const angle = Math.atan2(dy, dx);
  const metrics = arrowMetrics(length);
  const sw = metrics.shaft / 2;
  const hw = metrics.headWidth / 2;
  const local: Point[] = [
    { x: 0, y: -sw },
    { x: metrics.shaftEnd, y: -sw },
    { x: metrics.shaftEnd, y: -hw },
    { x: length, y: 0 },
    { x: metrics.shaftEnd, y: hw },
    { x: metrics.shaftEnd, y: sw },
    { x: 0, y: sw },
  ];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return local.map((point) => ({
    x: x1 + point.x * cos - point.y * sin,
    y: y1 + point.x * sin + point.y * cos,
  }));
}

export function polygonPath(points: Point[]): string {
  if (points.length === 0) return '';
  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`).join(' ')} Z`;
}

function round(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

export interface LabelPose {
  x: number;
  y: number;
  /** Degrees in [-90, 90], so the label is never upside down. */
  deg: number;
}

/** Label centred above the shaft. Rotation follows the arrow, then flips to stay readable. */
export function labelPose(x1: number, y1: number, x2: number, y2: number, gap: number): LabelPose {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);
  let deg = (angle * 180) / Math.PI;
  let nx = -Math.sin(angle);
  let ny = Math.cos(angle);
  if (deg > 90 || deg < -90) deg += deg > 0 ? -180 : 180;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return {
    x: (x1 + x2) / 2 + nx * gap,
    y: (y1 + y2) / 2 + ny * gap,
    deg,
  };
}

export function labelGap(length: number): number {
  return arrowMetrics(length).shaft / 2 + 16;
}

export function pointInPolygon(px: number, py: number, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    const intersect = a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function hitsBlockArrow(px: number, py: number, x1: number, y1: number, x2: number, y2: number): boolean {
  if (Math.hypot(x2 - x1, y2 - y1) < 1) return false;
  return pointInPolygon(px, py, blockArrowPolygon(x1, y1, x2, y2));
}
