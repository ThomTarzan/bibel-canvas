import type {
  Arrow,
  ArrowStyle,
  Block,
  Comment,
  ExportPrefs,
  FontFamilyId,
  Group,
  LogicRole,
  Project,
  TypographySettings,
} from '../types';
import type { DraftBlock } from './layout';
import { createId } from './ids';

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

export function emptyProject(now = new Date().toISOString()): Project {
  return {
    version: 1,
    reference: '',
    createdAt: now,
    updatedAt: now,
    grid: true,
    snap: false,
    blocks: [],
    groups: [],
    arrows: [],
    comments: [],
    typography: { fontFamily: 'elegant', fontSize: 17, fontWeight: 400 },
    exportPrefs: { hideComments: false, hideGuides: false },
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
  const arrows = project.arrows.filter((arrow) => {
    const ok = (id: string) => liveBlocks.has(id) || liveGroups.has(id);
    const keep = arrow.fromId !== arrow.toId && ok(arrow.fromId) && ok(arrow.toId);
    if (!keep) changed = true;
    return keep;
  });

  if (!changed) return project;
  return { ...project, blocks, groups, arrows };
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

function normalizeArrow(value: unknown): Arrow | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  if (typeof value.fromId !== 'string' || typeof value.toId !== 'string') return null;
  const style = STYLES.includes(value.style as ArrowStyle) ? (value.style as ArrowStyle) : 'straight';
  return {
    id: value.id,
    fromId: value.fromId,
    toId: value.toId,
    label: typeof value.label === 'string' ? value.label : '',
    style,
    color: typeof value.color === 'string' ? value.color : null,
  };
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
  };
}

function normalizeTypography(value: unknown): TypographySettings {
  const base = emptyProject().typography;
  if (!isRecord(value)) return base;
  return {
    fontFamily: FONTS.includes(value.fontFamily as FontFamilyId) ? (value.fontFamily as FontFamilyId) : base.fontFamily,
    fontSize: typeof value.fontSize === 'number' ? value.fontSize : base.fontSize,
    fontWeight: typeof value.fontWeight === 'number' ? value.fontWeight : base.fontWeight,
  };
}

function normalizeExport(value: unknown): ExportPrefs {
  if (!isRecord(value)) return { hideComments: false, hideGuides: false };
  return { hideComments: value.hideComments === true, hideGuides: value.hideGuides === true };
}

export function parseProject(value: unknown): Project | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.blocks)) return null;
  const now = new Date().toISOString();
  const project = emptyProject(typeof value.createdAt === 'string' ? value.createdAt : now);
  project.reference = typeof value.reference === 'string' ? value.reference : '';
  project.updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : project.createdAt;
  project.grid = value.grid !== false;
  project.snap = value.snap === true;
  project.typography = normalizeTypography(value.typography);
  project.exportPrefs = normalizeExport(value.exportPrefs);
  project.comments = Array.isArray(value.comments)
    ? value.comments.map(normalizeComment).filter((comment): comment is Comment => comment !== null)
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
