import { EXTRA_FRAME_COLORS, FRAME_PRESETS } from './colors';
import { RELATIONS } from './catalog';
import { createId } from './ids';
import type { DraftBlock } from './layout';
import type {
  Arrow,
  ArrowEnd,
  ArrowStyle,
  Block,
  Comment,
  Connector,
  ConnectorKind,
  ExportPrefs,
  FontFamilyId,
  Frame,
  FrameColor,
  FrameStyle,
  Group,
  LogicRole,
  Marker,
  MarkerKind,
  Project,
  RelationId,
  TypographySettings,
} from '../types';

const ROLES: LogicRole[] = [
  'hovedpåstand',
  'grunn',
  'følge',
  'formål',
  'motsetning',
  'forklaring',
  'sitat',
  'spørsmål',
];

const FONTS: FontFamilyId[] = ['elegant', 'neutral'];
const STYLES: ArrowStyle[] = ['straight', 'curved', 'dashed'];
const REL_IDS: RelationId[] = RELATIONS.map((item) => item.id);
const CONNECTOR_KINDS: ConnectorKind[] = ['apposisjon', 'motsetning', 'tillegg', 'konklusjon'];
const MARKER_KINDS: MarkerKind[] = ['innskutt', 'hovedpåstand'];
const FRAME_STYLES: FrameStyle[] = ['solid', 'dashed'];

export function defaultFrameColors(): FrameColor[] {
  return FRAME_PRESETS.map((preset, index) => ({
    id: `ramme_${index}_${preset.name}`,
    color: preset.color,
    name: preset.name,
  }));
}

export function emptyProject(now = new Date().toISOString()): Project {
  return {
    version: 2,
    reference: '',
    createdAt: now,
    updatedAt: now,
    grid: true,
    snap: false,
    blocks: [],
    groups: [],
    arrows: [],
    connectors: [],
    markers: [],
    frameColors: defaultFrameColors(),
    frames: [],
    comments: [],
    typography: { fontFamily: 'elegant', fontSize: 17, fontWeight: 400 },
    exportPrefs: { hideComments: false, hideGuides: false },
    showRelationLegend: true,
    showFrameLegend: true,
    showRoleIcons: true,
    showComments: true,
  };
}

export function makeBlock(draft: DraftBlock): Block {
  return {
    id: createId('b'),
    text: draft.text,
    x: draft.x,
    y: draft.y,
    kind: draft.kind,
    uncertain: draft.uncertain,
    fill: null,
    textColor: null,
    groupId: null,
    role: null,
    roleHidden: false,
    fontSize: null,
    fontWeight: null,
    fontFamily: null,
  };
}

export function mirrorEndIds<T extends { from: ArrowEnd; to: ArrowEnd; fromId: string; toId: string }>(item: T): T {
  return { ...item, fromId: item.from.targetId ?? '', toId: item.to.targetId ?? '' };
}

function liveId(id: string | null, blocks: Set<string>, groups: Set<string>): boolean {
  return Boolean(id) && (blocks.has(id as string) || groups.has(id as string));
}

function healEnd(end: ArrowEnd, blocks: Set<string>, groups: Set<string>): ArrowEnd | null {
  if (!end.targetId) return end;
  if (liveId(end.targetId, blocks, groups)) return end;
  if (end.edge) return null;
  return { x: end.x, y: end.y, targetId: null, edge: false };
}

function healLink<T extends { from: ArrowEnd; to: ArrowEnd; fromId: string; toId: string }>(
  item: T,
  blocks: Set<string>,
  groups: Set<string>,
): T | null {
  const from = healEnd(item.from, blocks, groups);
  const to = healEnd(item.to, blocks, groups);
  if (!from || !to) return null;
  const fromId = from.targetId ?? '';
  const toId = to.targetId ?? '';
  if (from === item.from && to === item.to && item.fromId === fromId && item.toId === toId) return item;
  return { ...item, from, to, fromId, toId };
}

export function syncProject(project: Project): Project {
  const knownGroups = new Set(project.groups.map((group) => group.id));
  let changed = false;
  const blocks = project.blocks.map((block) => {
    if (block.groupId && !knownGroups.has(block.groupId)) {
      changed = true;
      return { ...block, groupId: null };
    }
    return block;
  });

  const groups = project.groups
    .map((group) => {
      const blockIds = blocks.filter((block) => block.groupId === group.id).map((block) => block.id);
      if (blockIds.length !== group.blockIds.length || blockIds.some((id, index) => id !== group.blockIds[index])) {
        changed = true;
      }
      return { ...group, blockIds };
    })
    .filter((group) => {
      if (group.blockIds.length === 0) {
        changed = true;
        return false;
      }
      return true;
    });

  const liveBlocks = new Set(blocks.map((block) => block.id));
  const liveGroups = new Set(groups.map((group) => group.id));
  const live = new Set<string>([...liveBlocks, ...liveGroups]);

  const arrows = project.arrows.flatMap((arrow) => {
    const next = healLink(arrow, liveBlocks, liveGroups);
    if (!next) {
      changed = true;
      return [];
    }
    if (next !== arrow) changed = true;
    return [next];
  });

  const connectors = project.connectors.flatMap((connector) => {
    const next = healLink(connector, liveBlocks, liveGroups);
    if (!next) {
      changed = true;
      return [];
    }
    if (next !== connector) changed = true;
    return [next];
  });

  const markers = project.markers
    .map((marker) => {
      const targetIds = marker.targetIds.filter((id) => live.has(id));
      if (targetIds.length !== marker.targetIds.length) changed = true;
      return { ...marker, targetIds };
    })
    .filter((marker) => {
      if (marker.targetIds.length === 0) {
        changed = true;
        return false;
      }
      return true;
    });

  const frames = project.frames.filter((frame) => {
    const keep = live.has(frame.targetId);
    if (!keep) changed = true;
    return keep;
  });

  const comments = project.comments.filter((comment) => {
    if (!comment.targetId) return true;
    const keep = live.has(comment.targetId) || arrows.some((arrow) => arrow.id === comment.targetId) || connectors.some((item) => item.id === comment.targetId);
    if (!keep) changed = true;
    return keep;
  });

  if (!changed) return project;
  return { ...project, blocks, groups, arrows, connectors, markers, frames, comments };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function normalizeBlock(value: unknown): Block | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.text !== 'string') return null;
  if (typeof value.x !== 'number' || typeof value.y !== 'number') return null;
  const role = ROLES.includes(value.role as LogicRole) ? (value.role as LogicRole) : null;
  const fontFamily = FONTS.includes(value.fontFamily as FontFamilyId) ? (value.fontFamily as FontFamilyId) : null;
  return {
    id: value.id,
    text: value.text,
    x: value.x,
    y: value.y,
    kind: value.kind === 'number' ? 'number' : 'word',
    uncertain: value.uncertain === true,
    fill: typeof value.fill === 'string' ? value.fill : null,
    textColor: typeof value.textColor === 'string' ? value.textColor : null,
    groupId: typeof value.groupId === 'string' ? value.groupId : null,
    role,
    roleHidden: value.roleHidden === true,
    fontSize: typeof value.fontSize === 'number' ? value.fontSize : null,
    fontWeight: typeof value.fontWeight === 'number' ? value.fontWeight : null,
    fontFamily,
  };
}

function normalizeGroup(value: unknown): Group | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const blockIds = Array.isArray(value.blockIds) ? value.blockIds.filter((id): id is string => typeof id === 'string') : [];
  return { id: value.id, blockIds, fill: typeof value.fill === 'string' ? value.fill : null };
}

function normalizeEnd(value: unknown, legacyId: string): ArrowEnd {
  if (isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number') {
    return {
      x: value.x,
      y: value.y,
      targetId: typeof value.targetId === 'string' && value.targetId ? value.targetId : null,
      edge: value.edge === true,
    };
  }
  if (legacyId) return { x: 0, y: 0, targetId: legacyId, edge: true };
  return { x: 0, y: 0, targetId: null, edge: false };
}

function relationFrom(value: unknown, label: string): RelationId | null {
  if (typeof value === 'string' && REL_IDS.includes(value as RelationId)) return value as RelationId;
  const folded = label.trim().toLowerCase();
  return RELATIONS.find((item) => item.label === folded)?.id ?? null;
}

function normalizeArrow(value: unknown): Arrow | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const fromId = typeof value.fromId === 'string' ? value.fromId : '';
  const toId = typeof value.toId === 'string' ? value.toId : '';
  const hasEnds = isRecord(value.from) || isRecord(value.to);
  if (!fromId && !toId && !hasEnds) return null;
  const style = STYLES.includes(value.style as ArrowStyle) ? (value.style as ArrowStyle) : 'straight';
  const label = typeof value.label === 'string' ? value.label : '';
  const arrow: Arrow = {
    id: value.id,
    fromId,
    toId,
    label,
    style,
    color: typeof value.color === 'string' ? value.color : null,
    relation: relationFrom(value.relation, label),
    from: normalizeEnd(value.from, fromId),
    to: normalizeEnd(value.to, toId),
  };
  return mirrorEndIds(arrow);
}

function normalizeConnector(value: unknown): Connector | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  if (!CONNECTOR_KINDS.includes(value.kind as ConnectorKind)) return null;
  const fromId = typeof value.fromId === 'string' ? value.fromId : '';
  const toId = typeof value.toId === 'string' ? value.toId : '';
  const connector: Connector = {
    id: value.id,
    kind: value.kind as ConnectorKind,
    fromId,
    toId,
    from: normalizeEnd(value.from, fromId),
    to: normalizeEnd(value.to, toId),
  };
  return mirrorEndIds(connector);
}

function normalizeMarker(value: unknown): Marker | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  if (!MARKER_KINDS.includes(value.kind as MarkerKind)) return null;
  const targetIds = Array.isArray(value.targetIds) ? value.targetIds.filter((id): id is string => typeof id === 'string') : [];
  if (targetIds.length === 0) return null;
  return { id: value.id, kind: value.kind as MarkerKind, targetIds };
}

function normalizeFrameColor(value: unknown): FrameColor | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.color !== 'string') return null;
  return { id: value.id, color: value.color, name: typeof value.name === 'string' ? value.name : '' };
}

function normalizeFrame(value: unknown): Frame | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  if (typeof value.targetId !== 'string' || typeof value.colorId !== 'string') return null;
  const thickness = typeof value.thickness === 'number' ? Math.min(8, Math.max(1, value.thickness)) : 3;
  const style = FRAME_STYLES.includes(value.style as FrameStyle) ? (value.style as FrameStyle) : 'solid';
  return { id: value.id, targetId: value.targetId, colorId: value.colorId, thickness, style };
}

function normalizeComment(value: unknown): Comment | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  return {
    id: value.id,
    targetId: typeof value.targetId === 'string' ? value.targetId : null,
    x: typeof value.x === 'number' ? value.x : 0,
    y: typeof value.y === 'number' ? value.y : 0,
    text: typeof value.text === 'string' ? value.text : '',
    minimized: value.minimized === true,
    anchored: value.anchored === true,
  };
}

function normalizeTypography(value: unknown): TypographySettings {
  const base = emptyProject().typography;
  if (!isRecord(value)) return base;
  return {
    fontFamily: FONTS.includes(value.fontFamily as FontFamilyId) ? (value.fontFamily as FontFamilyId) : base.fontFamily,
    fontSize: typeof value.fontSize === 'number' ? clampFontSize(value.fontSize) : base.fontSize,
    fontWeight: value.fontWeight === 600 ? 600 : 400,
  };
}

export function clampFontSize(size: number): number {
  return Math.min(36, Math.max(13, Math.round(size)));
}

function normalizeExport(value: unknown): ExportPrefs {
  if (!isRecord(value)) return { hideComments: false, hideGuides: false };
  return { hideComments: value.hideComments === true, hideGuides: value.hideGuides === true };
}

export function nextFrameColor(existing: FrameColor[]): string {
  const used = new Set(existing.map((entry) => entry.color.toLowerCase()));
  const pool = [...FRAME_PRESETS.map((item) => item.color), ...EXTRA_FRAME_COLORS];
  return pool.find((color) => !used.has(color.toLowerCase())) ?? EXTRA_FRAME_COLORS[existing.length % EXTRA_FRAME_COLORS.length];
}

export function parseProject(value: unknown): Project | null {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2) || !Array.isArray(value.blocks)) return null;
  const now = new Date().toISOString();
  const project = emptyProject(typeof value.createdAt === 'string' ? value.createdAt : now);
  project.reference = typeof value.reference === 'string' ? value.reference : '';
  project.updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : project.createdAt;
  project.grid = value.grid !== false;
  project.snap = value.snap === true;
  project.typography = normalizeTypography(value.typography);
  project.exportPrefs = normalizeExport(value.exportPrefs);
  project.showRelationLegend = value.showRelationLegend !== false;
  project.showFrameLegend = value.showFrameLegend !== false;
  project.showRoleIcons = value.showRoleIcons !== false;
  project.showComments = value.showComments !== false;
  project.comments = Array.isArray(value.comments)
    ? value.comments.map(normalizeComment).filter((comment): comment is Comment => comment !== null)
    : [];
  project.frameColors = Array.isArray(value.frameColors)
    ? value.frameColors.map(normalizeFrameColor).filter((entry): entry is FrameColor => entry !== null)
    : defaultFrameColors();
  project.frames = Array.isArray(value.frames)
    ? value.frames.map(normalizeFrame).filter((frame): frame is Frame => frame !== null)
    : [];
  project.connectors = Array.isArray(value.connectors)
    ? value.connectors.map(normalizeConnector).filter((item): item is Connector => item !== null)
    : [];
  project.markers = Array.isArray(value.markers)
    ? value.markers.map(normalizeMarker).filter((item): item is Marker => item !== null)
    : [];

  const seen = new Set<string>();
  project.blocks = value.blocks
    .map(normalizeBlock)
    .filter((block): block is Block => {
      if (!block || seen.has(block.id)) return false;
      seen.add(block.id);
      return true;
    });
  project.groups = Array.isArray(value.groups)
    ? value.groups.map(normalizeGroup).filter((group): group is Group => group !== null)
    : [];
  project.arrows = Array.isArray(value.arrows)
    ? value.arrows.map(normalizeArrow).filter((arrow): arrow is Arrow => arrow !== null)
    : [];

  for (const group of project.groups) {
    for (const blockId of group.blockIds) {
      const block = project.blocks.find((item) => item.id === blockId);
      if (block && !block.groupId) block.groupId = group.id;
    }
  }

  return syncProject(project);
}
