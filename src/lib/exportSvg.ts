import { CONNECTORS, LOGIC_ROLES, relationCaption } from './catalog';
import { ARROW_OUTLINE } from './colors';
import { fontFamilyCss, projectFont } from './fonts';
import { blockArrowPolygon, labelGap, labelPose, polygonPath } from './arrowShape';
import {
  blockRectOf,
  commentOrigin,
  groupRectOf,
  linkPoints,
  markerBounds,
  targetRect,
} from './scene';
import type { Comment, Connector, Frame, Project } from '../types';

export interface ExportOptions {
  /** Null exports the whole canvas. */
  selection: string[] | null;
  hideComments: boolean;
  hideGuides: boolean;
}

export interface ExportSvg {
  svg: string;
  width: number;
  height: number;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoped(project: Project, selection: string[] | null): Project {
  if (!selection) return project;
  const picked = new Set(selection);
  const blockIds = new Set<string>();
  const groupIds = new Set<string>();

  for (const block of project.blocks) {
    if (picked.has(block.id) || (block.groupId && picked.has(block.groupId))) blockIds.add(block.id);
  }
  for (const group of project.groups) {
    if (picked.has(group.id) || group.blockIds.some((id) => blockIds.has(id))) groupIds.add(group.id);
  }

  const touches = (id: string | null) => Boolean(id && (blockIds.has(id) || groupIds.has(id)));
  const pull = (id: string | null) => {
    if (!id) return;
    if (project.blocks.some((block) => block.id === id)) blockIds.add(id);
    const group = project.groups.find((item) => item.id === id);
    if (group) {
      groupIds.add(group.id);
      group.blockIds.forEach((blockId) => blockIds.add(blockId));
    }
  };

  const arrows = project.arrows.filter(
    (arrow) => picked.has(arrow.id) || touches(arrow.from.targetId) || touches(arrow.to.targetId),
  );
  arrows.forEach((arrow) => {
    pull(arrow.from.targetId);
    pull(arrow.to.targetId);
  });
  const connectors = project.connectors.filter(
    (item) => picked.has(item.id) || touches(item.from.targetId) || touches(item.to.targetId),
  );
  connectors.forEach((item) => {
    pull(item.from.targetId);
    pull(item.to.targetId);
  });

  const idLive = (id: string) => blockIds.has(id) || groupIds.has(id) || arrows.some((arrow) => arrow.id === id) || connectors.some((item) => item.id === id);
  return {
    ...project,
    blocks: project.blocks.filter((block) => blockIds.has(block.id)),
    groups: project.groups.filter((group) => groupIds.has(group.id)),
    arrows,
    connectors,
    markers: project.markers.filter((marker) => picked.has(marker.id) || marker.targetIds.some((id) => idLive(id))),
    frames: project.frames.filter((frame) => idLive(frame.targetId)),
    comments: project.comments.filter((comment) => picked.has(comment.id) || (comment.targetId ? idLive(comment.targetId) : false)),
  };
}

export function buildExportSvg(project: Project, options: ExportOptions): ExportSvg {
  const view = scoped(project, options.selection);
  const parts: string[] = [];
  const rects = [
    ...view.blocks.map((block) => blockRectOf(view, block)),
    ...view.groups.flatMap((group) => {
      const rect = groupRectOf(view, group.id);
      return rect ? [rect] : [];
    }),
  ];
  for (const arrow of view.arrows) {
    const { a, b } = linkPoints(view, arrow.from, arrow.to);
    rects.push({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x) || 1, h: Math.abs(b.y - a.y) || 1 });
  }
  for (const connector of view.connectors) {
    const { a, b } = linkPoints(view, connector.from, connector.to);
    rects.push({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x) || 1, h: Math.abs(b.y - a.y) || 1 });
  }

  const minX = rects.length ? Math.min(...rects.map((rect) => rect.x)) : 0;
  const minY = rects.length ? Math.min(...rects.map((rect) => rect.y)) : 0;
  const maxX = rects.length ? Math.max(...rects.map((rect) => rect.x + rect.w)) : 320;
  const maxY = rects.length ? Math.max(...rects.map((rect) => rect.y + rect.h)) : 180;
  const pad = 36;
  const legend = view.showFrameLegend ? view.frameColors : [];
  const legendHeight = legend.length ? 28 + legend.length * 26 + 12 : 0;
  const width = Math.max(240, Math.ceil(maxX - minX + pad * 2 + 48));
  const height = Math.max(160, Math.ceil(maxY - minY + pad * 2 + 48 + legendHeight));
  const ox = pad - minX + 16;
  const oy = pad - minY + 16;

  parts.push(`<rect width="${width}" height="${height}" fill="#f4f1ea"/>`);
  if (view.grid && !options.hideGuides) {
    parts.push(
      `<defs><pattern id="guides" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="translate(${ox} ${oy})"><circle cx="1" cy="1" r="0.95" fill="#cfc6b8"/></pattern></defs>`,
    );
    parts.push(`<rect width="${width}" height="${height}" fill="url(#guides)"/>`);
  }

  parts.push(`<g transform="translate(${ox} ${oy})">`);
  for (const group of view.groups) {
    const rect = groupRectOf(view, group.id);
    if (!rect) continue;
    parts.push(
      `<rect x="${n(rect.x)}" y="${n(rect.y)}" width="${n(rect.w)}" height="${n(rect.h)}" rx="18" fill="${group.fill ?? 'rgba(214,208,196,0.55)'}" stroke="rgba(70,60,40,0.08)"/>`,
    );
  }

  for (const marker of view.markers.filter((item) => item.kind === 'innskutt')) {
    const rect = markerBounds(view, marker.targetIds);
    if (!rect) continue;
    parts.push(
      `<rect x="${n(rect.x)}" y="${n(rect.y)}" width="${n(rect.w)}" height="${n(rect.h)}" rx="16" fill="none" stroke="#5c564c" stroke-width="1.6" stroke-dasharray="7 5"/>`,
    );
  }

  for (const frame of view.frames) {
    const drawn = frameRect(view, frame);
    if (!drawn) continue;
    parts.push(
      `<rect x="${n(drawn.x)}" y="${n(drawn.y)}" width="${n(drawn.w)}" height="${n(drawn.h)}" rx="12" fill="none" stroke="${xml(drawn.color)}" stroke-width="${frame.thickness}" stroke-dasharray="${frame.style === 'dashed' ? '7 5' : 'none'}"/>`,
    );
  }

  for (const arrow of view.arrows) {
    const { a, b } = linkPoints(view, arrow.from, arrow.to);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1) continue;
    const color = arrow.color ?? ARROW_OUTLINE;
    parts.push(
      `<path d="${polygonPath(blockArrowPolygon(a.x, a.y, b.x, b.y))}" fill="none" stroke="${xml(color)}" stroke-width="1.7" stroke-linejoin="round"/>`,
    );
    const caption = relationCaption(arrow.relation, arrow.label);
    if (caption) {
      const pose = labelPose(a.x, a.y, b.x, b.y, labelGap(length));
      parts.push(
        `<text x="${n(pose.x)}" y="${n(pose.y)}" fill="${xml(color)}" font-family="${xml(fontFamilyCss('neutral'))}" font-size="14" font-weight="600" text-anchor="middle" dominant-baseline="middle" transform="rotate(${n(pose.deg)} ${n(pose.x)} ${n(pose.y)})">${xml(caption)}</text>`,
      );
    }
  }

  for (const connector of view.connectors) parts.push(connectorSvg(view, connector));

  for (const block of view.blocks) {
    const rect = blockRectOf(view, block);
    const font = projectFont(view, block);
    const fill = block.fill ?? (block.uncertain ? '#fbf6f0' : '#fffdf9');
    const ink = block.textColor ?? '#2a2622';
    const dash = block.uncertain ? ' stroke-dasharray="5 4"' : '';
    parts.push(
      `<rect x="${n(rect.x)}" y="${n(rect.y)}" width="${n(rect.w)}" height="${n(rect.h)}" rx="8" fill="${xml(fill)}" stroke="${block.uncertain ? '#a67c52' : '#e3dbd0'}"${dash}/>`,
    );
    parts.push(
      `<text x="${n(rect.x + rect.w / 2)}" y="${n(rect.y + rect.h / 2)}" fill="${xml(ink)}" font-family="${xml(fontFamilyCss(font.family))}" font-size="${font.size}" font-weight="${font.weight}" text-anchor="middle" dominant-baseline="middle">${xml(block.text)}</text>`,
    );
    if (view.showRoleIcons && block.role && !block.roleHidden) {
      const glyph = LOGIC_ROLES.find((role) => role.id === block.role)?.glyph ?? '';
      parts.push(
        `<text x="${n(rect.x - 2)}" y="${n(rect.y - 2)}" fill="#3f4f42" font-family="${xml(fontFamilyCss('neutral'))}" font-size="13" font-weight="700" text-anchor="middle">${xml(glyph)}</text>`,
      );
    }
    if (view.markers.some((marker) => marker.kind === 'hovedpåstand' && marker.targetIds.includes(block.id))) {
      parts.push(
        `<line x1="${n(rect.x + 6)}" y1="${n(rect.y + rect.h - 3)}" x2="${n(rect.x + rect.w - 6)}" y2="${n(rect.y + rect.h - 3)}" stroke="#2a2622" stroke-width="3" stroke-linecap="round"/>`,
      );
    }
  }

  for (const marker of view.markers.filter((item) => item.kind === 'hovedpåstand')) {
    for (const targetId of marker.targetIds) {
      const group = view.groups.find((item) => item.id === targetId);
      if (!group) continue;
      const rect = groupRectOf(view, group.id);
      if (!rect) continue;
      parts.push(
        `<line x1="${n(rect.x + 10)}" y1="${n(rect.y + rect.h - 5)}" x2="${n(rect.x + rect.w - 10)}" y2="${n(rect.y + rect.h - 5)}" stroke="#2a2622" stroke-width="3.5" stroke-linecap="round"/>`,
      );
    }
  }

  if (!options.hideComments && view.showComments) {
    for (const comment of view.comments) parts.push(commentSvg(view, comment));
  }
  parts.push(`</g>`);

  if (legend.length) {
    const top = height - legendHeight + 8;
    parts.push(`<g id="frame-legend">`);
    parts.push(
      `<text x="28" y="${n(top + 14)}" fill="#6e685f" font-family="${xml(fontFamilyCss('neutral'))}" font-size="12" font-weight="700">Rammer</text>`,
    );
    legend.forEach((entry, index) => {
      const y = top + 28 + index * 26;
      parts.push(`<rect x="28" y="${n(y)}" width="16" height="16" rx="4" fill="${xml(entry.color)}"/>`);
      parts.push(
        `<text x="52" y="${n(y + 12)}" fill="#2a2622" font-family="${xml(fontFamilyCss('neutral'))}" font-size="14" font-weight="600">${xml(entry.name || 'uten navn')}</text>`,
      );
    });
    parts.push(`</g>`);
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`;
  return { svg, width, height };
}

function frameRect(project: Project, frame: Frame): { x: number; y: number; w: number; h: number; color: string } | null {
  const rect = targetRect(project, frame.targetId);
  const color = project.frameColors.find((entry) => entry.id === frame.colorId)?.color;
  if (!rect || !color) return null;
  const pad = 4;
  return { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2, color };
}

function connectorSvg(project: Project, connector: Connector): string {
  const { a, b } = linkPoints(project, connector.from, connector.to);
  const glyph = CONNECTORS.find((item) => item.id === connector.kind)?.glyph ?? '';
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  return `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" stroke="#5c564c" stroke-width="1.4"/><text x="${n(midX)}" y="${n(midY)}" fill="#2a2622" font-family="${xml(fontFamilyCss('neutral'))}" font-size="22" font-weight="700" text-anchor="middle" dominant-baseline="middle">${xml(glyph)}</text>`;
}

function commentSvg(project: Project, comment: Comment): string {
  const origin = commentOrigin(project, comment);
  if (comment.minimized) {
    return `<circle cx="${n(origin.x + 8)}" cy="${n(origin.y + 8)}" r="7" fill="#fffdf9" stroke="#3f4f42" stroke-width="1.4"/>`;
  }
  const width = 180;
  const height = 72;
  return `<rect x="${n(origin.x)}" y="${n(origin.y)}" width="${width}" height="${height}" rx="10" fill="#fffdf9" stroke="#e4ddd2"/><text x="${n(origin.x + 10)}" y="${n(origin.y + 24)}" fill="#2a2622" font-family="${xml(fontFamilyCss('neutral'))}" font-size="13">${xml(comment.text)}</text>`;
}

function n(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}
