import type { ArrowEnd, Block, Comment, Project } from '../types';
import type { Point } from './arrowShape';
import { projectFont } from './fonts';
import { boundsOf, blockRect, type Rect } from './geometry';
import { BLOCK_H } from './layout';
import { measureTextWidth } from './measure';
import { resolveEnds, type SnapTarget } from './snap';

export const GROUP_PAD = 14;
export const MAGNET_DISTANCE = 26;

export function blockHeight(fontSize: number): number {
  return Math.max(BLOCK_H, Math.round(fontSize * 2));
}

export type PlaceFn = (blockId: string) => { x: number; y: number } | undefined;

export function blockRectOf(project: Project, block: Block, place?: PlaceFn): Rect {
  const font = projectFont(project, block);
  const at = place?.(block.id) ?? { x: block.x, y: block.y };
  return blockRect(at.x, at.y, measureTextWidth(block.text, font), blockHeight(font.size));
}

export function groupRectOf(project: Project, groupId: string, place?: PlaceFn): Rect | null {
  const group = project.groups.find((item) => item.id === groupId);
  if (!group) return null;
  const rects = group.blockIds.flatMap((blockId) => {
    const block = project.blocks.find((item) => item.id === blockId);
    return block ? [blockRectOf(project, block, place)] : [];
  });
  return boundsOf(rects, GROUP_PAD);
}

export function targetRect(project: Project, id: string | null, place?: PlaceFn): Rect | null {
  if (!id) return null;
  const block = project.blocks.find((item) => item.id === id);
  if (block) return blockRectOf(project, block, place);
  return groupRectOf(project, id, place);
}

export function snapTargets(project: Project, place?: PlaceFn): SnapTarget[] {
  const blocks = project.blocks.map((block) => ({ id: block.id, rect: blockRectOf(project, block, place) }));
  const groups = project.groups.flatMap((group) => {
    const rect = groupRectOf(project, group.id, place);
    return rect ? [{ id: group.id, rect }] : [];
  });
  return [...blocks, ...groups];
}

export function linkPoints(project: Project, from: ArrowEnd, to: ArrowEnd, place?: PlaceFn): { a: Point; b: Point } {
  return resolveEnds(from, to, targetRect(project, from.targetId, place), targetRect(project, to.targetId, place));
}

export function unionRects(rects: Rect[], pad = 0): Rect | null {
  return boundsOf(rects, pad);
}

export function markerBounds(project: Project, targetIds: string[], place?: PlaceFn): Rect | null {
  const rects = targetIds.flatMap((id) => {
    const rect = targetRect(project, id, place);
    return rect ? [rect] : [];
  });
  return boundsOf(rects, 8);
}

export function commentOrigin(project: Project, comment: Comment, place?: PlaceFn): Point {
  if (comment.anchored && comment.targetId) {
    const rect = targetRect(project, comment.targetId, place);
    if (rect) return { x: rect.x + rect.w + comment.x, y: rect.y + comment.y };
    const mid = linkMidpoint(project, comment.targetId, place);
    if (mid) return { x: mid.x + comment.x, y: mid.y + comment.y };
  }
  return { x: comment.x, y: comment.y };
}

export function linkMidpoint(project: Project, id: string, place?: PlaceFn): Point | null {
  const arrow = project.arrows.find((item) => item.id === id);
  if (arrow) {
    const { a, b } = linkPoints(project, arrow.from, arrow.to, place);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  const connector = project.connectors.find((item) => item.id === id);
  if (!connector) return null;
  const { a, b } = linkPoints(project, connector.from, connector.to, place);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Keep a free copy of ends whose target is about to disappear. */
export function detachEnds(project: Project, removed: Set<string>): Project {
  if (removed.size === 0) return project;
  const arrows = project.arrows.map((arrow) => freezeLink(project, arrow, removed));
  const connectors = project.connectors.map((connector) => freezeLink(project, connector, removed));
  const comments = project.comments.map((comment) => {
    if (!comment.targetId || !removed.has(comment.targetId) || !comment.anchored) return comment;
    const origin = commentOrigin(project, comment);
    return { ...comment, x: origin.x, y: origin.y, targetId: null, anchored: false };
  });
  if (arrows === project.arrows && connectors === project.connectors && comments === project.comments) return project;
  return { ...project, arrows, connectors, comments };
}

function freezeLink<T extends { from: ArrowEnd; to: ArrowEnd; fromId: string; toId: string }>(
  project: Project,
  item: T,
  removed: Set<string>,
): T {
  const fromGone = Boolean(item.from.targetId && removed.has(item.from.targetId));
  const toGone = Boolean(item.to.targetId && removed.has(item.to.targetId));
  if (!fromGone && !toGone) return item;
  const { a, b } = linkPoints(project, item.from, item.to);
  const from = fromGone ? { x: a.x, y: a.y, targetId: null, edge: false } : item.from;
  const to = toGone ? { x: b.x, y: b.y, targetId: null, edge: false } : item.to;
  return { ...item, from, to, fromId: from.targetId ?? '', toId: to.targetId ?? '' };
}

export function retargetEnds(project: Project, map: Map<string, string>): Project {
  if (map.size === 0) return project;
  const mapEnd = (end: ArrowEnd): ArrowEnd => {
    if (!end.targetId || !map.has(end.targetId)) return end;
    return { x: 0, y: 0, targetId: map.get(end.targetId) ?? null, edge: true };
  };
  const arrows = project.arrows.map((arrow) => {
    const from = mapEnd(arrow.from);
    const to = mapEnd(arrow.to);
    if (from === arrow.from && to === arrow.to) return arrow;
    return { ...arrow, from, to, fromId: from.targetId ?? '', toId: to.targetId ?? '' };
  });
  const connectors = project.connectors.map((connector) => {
    const from = mapEnd(connector.from);
    const to = mapEnd(connector.to);
    if (from === connector.from && to === connector.to) return connector;
    return { ...connector, from, to, fromId: from.targetId ?? '', toId: to.targetId ?? '' };
  });
  const comments = project.comments.map((comment) => {
    if (!comment.targetId || !map.has(comment.targetId)) return comment;
    return { ...comment, targetId: map.get(comment.targetId) ?? null };
  });
  const seenFrames = new Set<string>();
  const frames = project.frames.flatMap((frame) => {
    const targetId = map.get(frame.targetId) ?? frame.targetId;
    if (seenFrames.has(targetId)) return [];
    seenFrames.add(targetId);
    return [targetId === frame.targetId ? frame : { ...frame, targetId }];
  });
  const markers = project.markers.map((marker) => ({
    ...marker,
    targetIds: [...new Set(marker.targetIds.map((id) => map.get(id) ?? id))],
  }));
  return { ...project, arrows, connectors, comments, frames, markers };
}
