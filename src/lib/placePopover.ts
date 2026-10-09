export type PopoverPrefer = 'below' | 'around';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PopoverPlacement {
  left: number;
  top: number;
  maxHeight: number;
  maxWidth: number;
}

interface Candidate {
  left: number;
  top: number;
  width: number;
  height: number;
  maxHeight: number;
  maxWidth: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function overlaps(a: { left: number; top: number; width: number; height: number }, b: Box): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) return false;
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

/**
 * Place a popup so it prefers opening downward, flips above or beside the anchor
 * when that would leave the viewport, and never covers the anchor when a fit exists.
 */
export function placePopover(options: {
  anchor: Box;
  size: { width: number; height: number };
  viewport: { width: number; height: number };
  prefer: PopoverPrefer;
  gap?: number;
  margin?: number;
}): PopoverPlacement {
  const gap = options.gap ?? 8;
  const margin = options.margin ?? 12;
  const { anchor, viewport } = options;
  const vw = viewport.width;
  const vh = viewport.height;
  const neededW = Math.max(0, options.size.width);
  const neededH = Math.max(0, options.size.height);
  const maxWidth = Math.max(0, vw - margin * 2);
  const maxHeight = Math.max(0, vh - margin * 2);
  const width = Math.min(neededW, maxWidth);
  const height = Math.min(neededH, maxHeight);

  const centerLeft = clamp(anchor.left + anchor.width / 2 - width / 2, margin, Math.max(margin, vw - margin - width));

  const belowTop = anchor.top + anchor.height + gap;
  const spaceBelow = vh - margin - belowTop;
  const below: Candidate = {
    left: centerLeft,
    top: belowTop,
    width,
    height: Math.min(height, Math.max(0, spaceBelow)),
    maxHeight: Math.max(0, spaceBelow),
    maxWidth,
  };

  const spaceAbove = anchor.top - gap - margin;
  const aboveHeight = Math.min(height, Math.max(0, spaceAbove));
  const above: Candidate = {
    left: centerLeft,
    top: anchor.top - gap - aboveHeight,
    width,
    height: aboveHeight,
    maxHeight: Math.max(0, spaceAbove),
    maxWidth,
  };

  const rightLeft = anchor.left + anchor.width + gap;
  const spaceRight = vw - margin - rightLeft;
  let rightTop = anchor.top;
  if (rightTop + height > vh - margin) rightTop = Math.max(margin, vh - margin - height);
  const right: Candidate = {
    left: rightLeft,
    top: rightTop,
    width: Math.min(width, Math.max(0, spaceRight)),
    height,
    maxHeight,
    maxWidth: Math.max(0, spaceRight),
  };

  const spaceLeft = anchor.left - gap - margin;
  const leftWidth = Math.min(width, Math.max(0, spaceLeft));
  let leftTop = anchor.top;
  if (leftTop + height > vh - margin) leftTop = Math.max(margin, vh - margin - height);
  const left: Candidate = {
    left: anchor.left - gap - leftWidth,
    top: leftTop,
    width: leftWidth,
    height,
    maxHeight,
    maxWidth: Math.max(0, spaceLeft),
  };

  const order = options.prefer === 'around' ? [below, above, right, left] : [below, above];
  const targetH = Math.min(neededH, maxHeight);
  const targetW = Math.min(neededW, maxWidth);

  const fully = (candidate: Candidate) =>
    candidate.maxHeight + 0.5 >= targetH &&
    candidate.maxWidth + 0.5 >= targetW &&
    candidate.height + 0.5 >= targetH &&
    candidate.width + 0.5 >= targetW &&
    candidate.top >= margin - 0.5 &&
    candidate.left >= margin - 0.5 &&
    candidate.left + candidate.width <= vw - margin + 0.5 &&
    candidate.top + candidate.height <= vh - margin + 0.5 &&
    !overlaps(candidate, anchor);

  for (const candidate of order) {
    if (fully(candidate)) {
      return {
        left: candidate.left,
        top: candidate.top,
        maxHeight: candidate.maxHeight,
        maxWidth: candidate.maxWidth,
      };
    }
  }

  let best: Candidate | null = null;
  let bestArea = -1;
  for (const candidate of order) {
    if (candidate.width < 40 || candidate.height < 40) continue;
    if (candidate.top < margin - 0.5 || candidate.left < margin - 0.5) continue;
    if (candidate.left + candidate.width > vw - margin + 0.5) continue;
    if (candidate.top + candidate.height > vh - margin + 0.5) continue;
    if (overlaps(candidate, anchor)) continue;
    const area = candidate.width * candidate.height;
    if (area > bestArea) {
      best = candidate;
      bestArea = area;
    }
  }

  if (best) {
    return { left: best.left, top: best.top, maxHeight: best.maxHeight, maxWidth: best.maxWidth };
  }

  return {
    left: centerLeft,
    top: clamp(belowTop, margin, Math.max(margin, vh - margin - Math.max(height, 40))),
    maxHeight,
    maxWidth,
  };
}
