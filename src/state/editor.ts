import { analyzeText, formatRemovedToast, kindFromText } from '../lib/classify';
import { projectFont } from '../lib/fonts';
import { createId } from '../lib/ids';
import { layoutAnalysis, WORD_GAP } from '../lib/layout';
import { measureTextWidth } from '../lib/measure';
import { clampFontSize, emptyProject, makeBlock, mirrorEndIds, parseProject, syncProject } from '../lib/project';
import { detachEnds, retargetEnds } from '../lib/scene';
import { tokenizeLine } from '../lib/tokenize';
import type {
  Arrow,
  ArrowEnd,
  Block,
  Comment,
  Connector,
  ExportPrefs,
  FontFamilyId,
  FrameStyle,
  LogicRole,
  Marker,
  Project,
  TypographySettings,
} from '../types';

export interface ToastState {
  message: string;
  offerUndo: boolean;
}

export interface EditorState {
  project: Project;
  past: Project[];
  future: Project[];
  toast: ToastState | null;
}

export type EditorAction =
  | { type: 'import-text'; text: string; reference: string; now?: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'delete-ids'; ids: string[] }
  | { type: 'delete-all-numbers' }
  | { type: 'commit-move'; positions: { id: string; x: number; y: number }[] }
  | { type: 'set-text'; id: string; text: string }
  | { type: 'group'; blockIds: string[] }
  | { type: 'ungroup'; groupIds: string[]; blockIds: string[] }
  | { type: 'merge'; blockIds: string[] }
  | { type: 'split'; blockId: string }
  | { type: 'set-fill'; blockIds: string[]; color: string | null }
  | { type: 'set-text-color'; blockIds: string[]; color: string | null }
  | { type: 'set-group-fill'; groupIds: string[]; color: string | null }
  | { type: 'set-arrow-color'; arrowIds: string[]; color: string | null }
  | { type: 'add-arrow'; arrow: Arrow }
  | { type: 'update-arrow'; id: string; patch: Partial<Pick<Arrow, 'label' | 'style' | 'color' | 'relation' | 'from' | 'to'>> }
  | { type: 'add-connector'; connector: Connector }
  | { type: 'update-connector'; id: string; patch: Partial<Pick<Connector, 'from' | 'to' | 'kind'>> }
  | { type: 'add-marker'; marker: Marker }
  | { type: 'toggle-hovedpastand'; targetIds: string[] }
  | { type: 'set-role'; blockIds: string[]; role: LogicRole | null }
  | { type: 'set-role-hidden'; blockIds: string[]; hidden: boolean }
  | { type: 'toggle-role-icons' }
  | { type: 'toggle-relation-legend' }
  | { type: 'toggle-frame-legend' }
  | { type: 'toggle-comments-visible' }
  | { type: 'add-comment'; comment: Comment }
  | { type: 'update-comment'; id: string; patch: Partial<Pick<Comment, 'text' | 'minimized' | 'x' | 'y' | 'anchored' | 'targetId'>> }
  | { type: 'set-typography'; patch: Partial<TypographySettings> }
  | {
      type: 'set-block-font';
      blockIds: string[];
      patch: { fontFamily?: FontFamilyId | null; fontSize?: number | null; fontWeight?: number | null };
    }
  | { type: 'set-frames'; targetIds: string[]; colorId: string; thickness: number; style: FrameStyle }
  | { type: 'clear-frames'; targetIds: string[] }
  | { type: 'add-frame-color'; id: string; color: string; name: string }
  | { type: 'update-frame-color'; id: string; patch: Partial<{ name: string; color: string }> }
  | { type: 'delete-frame-color'; id: string }
  | { type: 'set-export-prefs'; patch: Partial<ExportPrefs> }
  | { type: 'toggle-grid' }
  | { type: 'toggle-snap' }
  | { type: 'set-reference'; reference: string }
  | { type: 'load'; project: Project }
  | { type: 'set-toast'; toast: ToastState | null };

const HISTORY_LIMIT = 80;

export function createEditorState(project?: Project): EditorState {
  return { project: project ?? emptyProject(), past: [], future: [], toast: null };
}

function commit(state: EditorState, project: Project, toast: ToastState | null = null, now?: string): EditorState {
  if (project === state.project) return toast === state.toast ? state : { ...state, toast };
  return {
    project: { ...project, updatedAt: now ?? new Date().toISOString() },
    past: [...state.past, structuredClone(state.project)].slice(-HISTORY_LIMIT),
    future: [],
    toast,
  };
}

function deleteIds(project: Project, ids: string[]): Project {
  const removeBlocks = new Set<string>();
  const removeArrows = new Set<string>();
  const removeConnectors = new Set<string>();
  const removeMarkers = new Set<string>();
  const removeComments = new Set<string>();
  const removeGroups = new Set<string>();
  for (const id of ids) {
    if (project.blocks.some((block) => block.id === id)) removeBlocks.add(id);
    if (project.arrows.some((arrow) => arrow.id === id)) removeArrows.add(id);
    if (project.connectors.some((connector) => connector.id === id)) removeConnectors.add(id);
    if (project.markers.some((marker) => marker.id === id)) removeMarkers.add(id);
    if (project.comments.some((comment) => comment.id === id)) removeComments.add(id);
    const group = project.groups.find((item) => item.id === id);
    if (group) {
      removeGroups.add(group.id);
      group.blockIds.forEach((blockId) => removeBlocks.add(blockId));
    }
  }
  const direct =
    removeBlocks.size + removeArrows.size + removeConnectors.size + removeMarkers.size + removeComments.size + removeGroups.size;
  if (direct === 0) return project;
  const detached = detachEnds(project, new Set([...removeBlocks, ...removeGroups]));
  return syncProject({
    ...detached,
    blocks: detached.blocks.filter((block) => !removeBlocks.has(block.id)),
    arrows: detached.arrows.filter((arrow) => !removeArrows.has(arrow.id)),
    connectors: detached.connectors.filter((connector) => !removeConnectors.has(connector.id)),
    markers: detached.markers.filter((marker) => !removeMarkers.has(marker.id)),
    comments: detached.comments.filter((comment) => !removeComments.has(comment.id)),
  });
}

function endExists(project: Project, end: ArrowEnd): boolean {
  if (!end.targetId) return true;
  return endpointExists(project, end.targetId);
}

function sameEnd(a: ArrowEnd, b: ArrowEnd): boolean {
  return a.x === b.x && a.y === b.y && a.targetId === b.targetId && a.edge === b.edge;
}

function endpointExists(project: Project, id: string): boolean {
  return project.blocks.some((block) => block.id === id) || project.groups.some((group) => group.id === id);
}

export function reduce(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'set-toast':
      return { ...state, toast: action.toast };
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state.toast ? { ...state, toast: null } : state;
      return {
        project: previous,
        past: state.past.slice(0, -1),
        future: [structuredClone(state.project), ...state.future].slice(0, HISTORY_LIMIT),
        toast: null,
      };
    }
    case 'redo': {
      const next = state.future[0];
      if (!next) return state;
      return {
        project: next,
        past: [...state.past, structuredClone(state.project)].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        toast: null,
      };
    }
    case 'import-text': {
      if (!action.text.trim()) return state;
      const now = action.now ?? new Date().toISOString();
      const analysis = analyzeText(action.text);
      const layout = (includeVerseNumbers: boolean) =>
        layoutAnalysis(analysis, { includeVerseNumbers, measure: measureTextWidth }).map((draft) => makeBlock(draft));
      const base: Project = {
        ...state.project,
        reference: action.reference.trim(),
        createdAt: state.project.blocks.length === 0 ? now : state.project.createdAt,
        updatedAt: now,
        blocks: [],
        groups: [],
        arrows: [],
        connectors: [],
        markers: [],
        frames: [],
        comments: [],
      };
      const next: Project = { ...base, blocks: layout(false) };
      const removed = analysis.removedVerseNumbers.length;
      if (removed === 0) return commit(state, next, null, now);
      const intermediate: Project = { ...base, blocks: layout(true) };
      return {
        project: next,
        past: [...state.past, structuredClone(state.project), structuredClone(intermediate)].slice(-HISTORY_LIMIT),
        future: [],
        toast: { message: formatRemovedToast(removed), offerUndo: true },
      };
    }
    case 'delete-ids':
      return commit(state, deleteIds(state.project, action.ids));
    case 'delete-all-numbers': {
      const removed = new Set(state.project.blocks.filter((block) => block.kind === 'number').map((block) => block.id));
      if (removed.size === 0) return state;
      const detached = detachEnds(state.project, removed);
      return commit(
        state,
        syncProject({ ...detached, blocks: detached.blocks.filter((block) => !removed.has(block.id)) }),
      );
    }
    case 'commit-move': {
      const positions = new Map(action.positions.map((position) => [position.id, position]));
      let changed = false;
      const blocks = state.project.blocks.map((block) => {
        const position = positions.get(block.id);
        if (!position || (position.x === block.x && position.y === block.y)) return block;
        changed = true;
        return { ...block, x: position.x, y: position.y };
      });
      if (!changed) return state;
      return commit(state, { ...state.project, blocks });
    }
    case 'set-text': {
      const cleaned = action.text.replace(/\s+/g, ' ').trim();
      if (!cleaned) return commit(state, deleteIds(state.project, [action.id]));
      const kind = kindFromText(cleaned);
      let changed = false;
      const blocks = state.project.blocks.map((block) => {
        if (block.id !== action.id) return block;
        if (block.text === cleaned && block.kind === kind.kind && !block.uncertain) return block;
        changed = true;
        return { ...block, text: cleaned, kind: kind.kind, uncertain: false };
      });
      if (!changed) return state;
      return commit(state, { ...state.project, blocks });
    }
    case 'group': {
      const unique = [...new Set(action.blockIds)];
      const chosen = state.project.blocks.filter((block) => unique.includes(block.id));
      if (chosen.length < 2) return state;
      const shared = chosen[0].groupId;
      const already =
        Boolean(shared) &&
        chosen.every((block) => block.groupId === shared) &&
        state.project.groups.some((group) => group.id === shared && group.blockIds.length === chosen.length);
      if (already) return state;
      const id = createId('g');
      const selected = new Set(unique);
      const blocks = state.project.blocks.map((block) => (selected.has(block.id) ? { ...block, groupId: id } : block));
      const groups = [...state.project.groups, { id, blockIds: unique, fill: null }];
      return commit(state, syncProject({ ...state.project, blocks, groups }));
    }
    case 'ungroup': {
      const ids = new Set(action.groupIds);
      for (const block of state.project.blocks) {
        if (action.blockIds.includes(block.id) && block.groupId) ids.add(block.groupId);
      }
      if (ids.size === 0) return state;
      const detached = detachEnds(state.project, ids);
      const blocks = detached.blocks.map((block) =>
        block.groupId && ids.has(block.groupId) ? { ...block, groupId: null } : block,
      );
      const groups = detached.groups.filter((group) => !ids.has(group.id));
      return commit(state, syncProject({ ...detached, blocks, groups }));
    }
    case 'merge': {
      const chosen = state.project.blocks.filter((block) => action.blockIds.includes(block.id));
      if (chosen.length < 2) return state;
      const ordered = [...chosen].sort((a, b) => a.y - b.y || a.x - b.x);
      const [first] = ordered;
      const text = ordered.map((block) => block.text).join(' ');
      const kind = kindFromText(text);
      const merged: Block = { ...first, id: createId('b'), text, kind: kind.kind, uncertain: false };
      const remove = new Set(ordered.map((block) => block.id));
      const map = new Map([...remove].map((id) => [id, merged.id]));
      const retargeted = retargetEnds(state.project, map);
      const blocks = retargeted.blocks.flatMap((block) => {
        if (block.id === first.id) return [merged];
        if (remove.has(block.id)) return [];
        return [block];
      });
      const arrows = retargeted.arrows.filter((arrow) => arrow.from.targetId !== arrow.to.targetId || !arrow.from.targetId);
      const connectors = retargeted.connectors.filter(
        (connector) => connector.from.targetId !== connector.to.targetId || !connector.from.targetId,
      );
      return commit(state, syncProject({ ...retargeted, blocks, arrows, connectors }));
    }
    case 'split': {
      const block = state.project.blocks.find((item) => item.id === action.blockId);
      if (!block) return state;
      const tokens = tokenizeLine(block.text);
      if (tokens.length < 2) return state;
      let x = block.x;
      const created = tokens.map((text) => {
        const kind = kindFromText(text);
        const next: Block = {
          ...block,
          id: createId('b'),
          text,
          x,
          kind: kind.kind,
          uncertain: block.uncertain && kind.kind === 'number',
        };
        x += measureTextWidth(text, projectFont(state.project, block)) + WORD_GAP;
        return next;
      });
      const retargeted = retargetEnds(state.project, new Map([[block.id, created[0].id]]));
      const blocks = retargeted.blocks.flatMap((item) => (item.id === block.id ? created : [item]));
      return commit(state, syncProject({ ...retargeted, blocks }));
    }
    case 'set-fill':
    case 'set-text-color': {
      const key = action.type === 'set-fill' ? 'fill' : 'textColor';
      const selected = new Set(action.blockIds);
      let changed = false;
      const blocks = state.project.blocks.map((block) => {
        if (!selected.has(block.id) || block[key] === action.color) return block;
        changed = true;
        return { ...block, [key]: action.color };
      });
      if (!changed) return state;
      return commit(state, { ...state.project, blocks });
    }
    case 'set-group-fill': {
      const selected = new Set(action.groupIds);
      let changed = false;
      const groups = state.project.groups.map((group) => {
        if (!selected.has(group.id) || group.fill === action.color) return group;
        changed = true;
        return { ...group, fill: action.color };
      });
      if (!changed) return state;
      return commit(state, { ...state.project, groups });
    }
    case 'set-arrow-color': {
      const selected = new Set(action.arrowIds);
      let changed = false;
      const arrows = state.project.arrows.map((arrow) => {
        if (!selected.has(arrow.id) || arrow.color === action.color) return arrow;
        changed = true;
        return { ...arrow, color: action.color };
      });
      if (!changed) return state;
      return commit(state, { ...state.project, arrows });
    }
    case 'add-arrow': {
      const arrow = mirrorEndIds({
        ...action.arrow,
        relation: action.arrow.relation ?? null,
        from: action.arrow.from ?? { x: 0, y: 0, targetId: action.arrow.fromId || null, edge: Boolean(action.arrow.fromId) },
        to: action.arrow.to ?? { x: 0, y: 0, targetId: action.arrow.toId || null, edge: Boolean(action.arrow.toId) },
      });
      if (!endExists(state.project, arrow.from) || !endExists(state.project, arrow.to)) return state;
      if (arrow.from.targetId && arrow.from.targetId === arrow.to.targetId && arrow.from.edge && arrow.to.edge) return state;
      if (!arrow.from.targetId && !arrow.to.targetId && Math.hypot(arrow.to.x - arrow.from.x, arrow.to.y - arrow.from.y) < 8) {
        return state;
      }
      return commit(state, { ...state.project, arrows: [...state.project.arrows, arrow] });
    }
    case 'update-arrow': {
      let changed = false;
      const arrows = state.project.arrows.map((arrow) => {
        if (arrow.id !== action.id) return arrow;
        const next = mirrorEndIds({ ...arrow, ...action.patch });
        if (
          next.label === arrow.label &&
          next.style === arrow.style &&
          next.color === arrow.color &&
          next.relation === arrow.relation &&
          next.fromId === arrow.fromId &&
          next.toId === arrow.toId &&
          sameEnd(next.from, arrow.from) &&
          sameEnd(next.to, arrow.to)
        ) {
          return arrow;
        }
        changed = true;
        return next;
      });
      if (!changed) return state;
      return commit(state, { ...state.project, arrows });
    }
    case 'add-connector': {
      const connector = mirrorEndIds(action.connector);
      if (!endExists(state.project, connector.from) || !endExists(state.project, connector.to)) return state;
      if (!connector.from.targetId && !connector.to.targetId && Math.hypot(connector.to.x - connector.from.x, connector.to.y - connector.from.y) < 8) {
        return state;
      }
      return commit(state, { ...state.project, connectors: [...state.project.connectors, connector] });
    }
    case 'update-connector': {
      let changed = false;
      const connectors = state.project.connectors.map((connector) => {
        if (connector.id !== action.id) return connector;
        const next = mirrorEndIds({ ...connector, ...action.patch });
        if (next.kind === connector.kind && next.fromId === connector.fromId && next.toId === connector.toId && sameEnd(next.from, connector.from) && sameEnd(next.to, connector.to)) {
          return connector;
        }
        changed = true;
        return next;
      });
      if (!changed) return state;
      return commit(state, { ...state.project, connectors });
    }
    case 'add-marker': {
      const targetIds = [...new Set(action.marker.targetIds.filter((id) => endpointExists(state.project, id)))];
      if (targetIds.length === 0) return state;
      return commit(state, { ...state.project, markers: [...state.project.markers, { ...action.marker, targetIds }] });
    }
    case 'toggle-hovedpastand': {
      const targetIds = action.targetIds.filter((id) => endpointExists(state.project, id));
      if (targetIds.length === 0) return state;
      let markers = state.project.markers;
      const additions: Marker[] = [];
      for (const id of targetIds) {
        const existing = markers.find(
          (marker) => marker.kind === 'hovedpåstand' && marker.targetIds.length === 1 && marker.targetIds[0] === id,
        );
        if (existing) markers = markers.filter((marker) => marker.id !== existing.id);
        else additions.push({ id: createId('m'), kind: 'hovedpåstand', targetIds: [id] });
      }
      return commit(state, { ...state.project, markers: [...markers, ...additions] });
    }
    case 'set-role': {
      const selected = new Set(action.blockIds);
      let changed = false;
      const blocks = state.project.blocks.map((block) => {
        if (!selected.has(block.id) || block.role === action.role) return block;
        changed = true;
        return { ...block, role: action.role, roleHidden: action.role ? block.roleHidden : false };
      });
      if (!changed) return state;
      return commit(state, { ...state.project, blocks });
    }
    case 'set-role-hidden': {
      const selected = new Set(action.blockIds);
      let changed = false;
      const blocks = state.project.blocks.map((block) => {
        if (!selected.has(block.id) || !block.role || block.roleHidden === action.hidden) return block;
        changed = true;
        return { ...block, roleHidden: action.hidden };
      });
      if (!changed) return state;
      return commit(state, { ...state.project, blocks });
    }
    case 'toggle-role-icons':
      return commit(state, { ...state.project, showRoleIcons: !state.project.showRoleIcons });
    case 'toggle-relation-legend':
      return commit(state, { ...state.project, showRelationLegend: !state.project.showRelationLegend });
    case 'toggle-frame-legend':
      return commit(state, { ...state.project, showFrameLegend: !state.project.showFrameLegend });
    case 'toggle-comments-visible':
      return commit(state, { ...state.project, showComments: !state.project.showComments });
    case 'add-comment':
      return commit(state, { ...state.project, comments: [...state.project.comments, action.comment] });
    case 'update-comment': {
      let changed = false;
      const comments = state.project.comments.map((comment) => {
        if (comment.id !== action.id) return comment;
        const next = { ...comment, ...action.patch };
        if (
          next.text === comment.text &&
          next.minimized === comment.minimized &&
          next.x === comment.x &&
          next.y === comment.y &&
          next.anchored === comment.anchored &&
          next.targetId === comment.targetId
        ) {
          return comment;
        }
        changed = true;
        return next;
      });
      if (!changed) return state;
      return commit(state, { ...state.project, comments });
    }
    case 'set-typography': {
      const next = {
        fontFamily: action.patch.fontFamily ?? state.project.typography.fontFamily,
        fontSize: action.patch.fontSize != null ? clampFontSize(action.patch.fontSize) : state.project.typography.fontSize,
        fontWeight: action.patch.fontWeight === 600 ? 600 : action.patch.fontWeight === 400 ? 400 : state.project.typography.fontWeight,
      };
      if (
        next.fontFamily === state.project.typography.fontFamily &&
        next.fontSize === state.project.typography.fontSize &&
        next.fontWeight === state.project.typography.fontWeight
      ) {
        return state;
      }
      return commit(state, { ...state.project, typography: next });
    }
    case 'set-block-font': {
      const selected = new Set(action.blockIds);
      let changed = false;
      const blocks = state.project.blocks.map((block) => {
        if (!selected.has(block.id)) return block;
        const fontFamily = action.patch.fontFamily !== undefined ? action.patch.fontFamily : block.fontFamily;
        const fontSize = action.patch.fontSize !== undefined ? (action.patch.fontSize == null ? null : clampFontSize(action.patch.fontSize)) : block.fontSize;
        const fontWeight = action.patch.fontWeight !== undefined ? (action.patch.fontWeight === 600 ? 600 : action.patch.fontWeight === 400 ? 400 : null) : block.fontWeight;
        if (fontFamily === block.fontFamily && fontSize === block.fontSize && fontWeight === block.fontWeight) return block;
        changed = true;
        return { ...block, fontFamily, fontSize, fontWeight };
      });
      if (!changed) return state;
      return commit(state, { ...state.project, blocks });
    }
    case 'set-frames': {
      if (!state.project.frameColors.some((entry) => entry.id === action.colorId)) return state;
      const targetIds = action.targetIds.filter((id) => endpointExists(state.project, id));
      if (targetIds.length === 0) return state;
      const thickness = Math.min(8, Math.max(1, action.thickness));
      const kept = state.project.frames.filter((frame) => !targetIds.includes(frame.targetId));
      const frames = [
        ...kept,
        ...targetIds.map((targetId) => ({
          id: createId('f'),
          targetId,
          colorId: action.colorId,
          thickness,
          style: action.style,
        })),
      ];
      return commit(state, { ...state.project, frames });
    }
    case 'clear-frames': {
      const targetIds = new Set(action.targetIds);
      const frames = state.project.frames.filter((frame) => !targetIds.has(frame.targetId));
      if (frames.length === state.project.frames.length) return state;
      return commit(state, { ...state.project, frames });
    }
    case 'add-frame-color': {
      if (state.project.frameColors.some((entry) => entry.id === action.id)) return state;
      return commit(state, {
        ...state.project,
        frameColors: [...state.project.frameColors, { id: action.id, color: action.color, name: action.name }],
      });
    }
    case 'update-frame-color': {
      let changed = false;
      const frameColors = state.project.frameColors.map((entry) => {
        if (entry.id !== action.id) return entry;
        const next = { ...entry, ...action.patch };
        if (next.name === entry.name && next.color === entry.color) return entry;
        changed = true;
        return next;
      });
      if (!changed) return state;
      return commit(state, { ...state.project, frameColors });
    }
    case 'delete-frame-color': {
      if (!state.project.frameColors.some((entry) => entry.id === action.id)) return state;
      return commit(state, {
        ...state.project,
        frameColors: state.project.frameColors.filter((entry) => entry.id !== action.id),
        frames: state.project.frames.filter((frame) => frame.colorId !== action.id),
      });
    }
    case 'set-export-prefs': {
      const next = { ...state.project.exportPrefs, ...action.patch };
      if (next.hideComments === state.project.exportPrefs.hideComments && next.hideGuides === state.project.exportPrefs.hideGuides) {
        return state;
      }
      return commit(state, { ...state.project, exportPrefs: next });
    }
    case 'toggle-grid':
      return commit(state, { ...state.project, grid: !state.project.grid });
    case 'toggle-snap':
      return commit(state, { ...state.project, snap: !state.project.snap });
    case 'set-reference':
      if (state.project.reference === action.reference) return state;
      return commit(state, { ...state.project, reference: action.reference });
    case 'load':
      return commit(state, action.project, null);
    default:
      return state;
  }
}

export function readStoredProject(raw: string | null): Project | null {
  if (!raw) return null;
  try {
    return parseProject(JSON.parse(raw));
  } catch {
    return null;
  }
}
