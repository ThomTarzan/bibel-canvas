import { analyzeText, formatRemovedToast, kindFromText } from '../lib/classify';
import { createId } from '../lib/ids';
import { layoutAnalysis, WORD_GAP } from '../lib/layout';
import { measureTextWidth } from '../lib/measure';
import { emptyProject, makeBlock, parseProject, syncProject } from '../lib/project';
import { tokenizeLine } from '../lib/tokenize';
import type { Arrow, Block, Project } from '../types';

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
  | { type: 'update-arrow'; id: string; patch: Partial<Pick<Arrow, 'label' | 'style' | 'color'>> }
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
  for (const id of ids) {
    if (project.blocks.some((block) => block.id === id)) removeBlocks.add(id);
    if (project.arrows.some((arrow) => arrow.id === id)) removeArrows.add(id);
    const group = project.groups.find((item) => item.id === id);
    if (group) group.blockIds.forEach((blockId) => removeBlocks.add(blockId));
  }
  if (removeBlocks.size === 0 && removeArrows.size === 0) return project;
  return syncProject({
    ...project,
    blocks: project.blocks.filter((block) => !removeBlocks.has(block.id)),
    arrows: project.arrows.filter((arrow) => !removeArrows.has(arrow.id)),
  });
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
      const blocks = state.project.blocks.filter((block) => block.kind !== 'number');
      if (blocks.length === state.project.blocks.length) return state;
      return commit(state, syncProject({ ...state.project, blocks }));
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
      const blocks = state.project.blocks.map((block) =>
        block.groupId && ids.has(block.groupId) ? { ...block, groupId: null } : block,
      );
      const groups = state.project.groups.filter((group) => !ids.has(group.id));
      return commit(state, syncProject({ ...state.project, blocks, groups }));
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
      const blocks = state.project.blocks.flatMap((block) => {
        if (block.id === first.id) return [merged];
        if (remove.has(block.id)) return [];
        return [block];
      });
      const arrows = state.project.arrows.flatMap((arrow) => {
        const fromId = remove.has(arrow.fromId) ? merged.id : arrow.fromId;
        const toId = remove.has(arrow.toId) ? merged.id : arrow.toId;
        if (fromId === toId) return [];
        return fromId === arrow.fromId && toId === arrow.toId ? [arrow] : [{ ...arrow, fromId, toId }];
      });
      return commit(state, syncProject({ ...state.project, blocks, arrows }));
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
        x += measureTextWidth(text) + WORD_GAP;
        return next;
      });
      const blocks = state.project.blocks.flatMap((item) => (item.id === block.id ? created : [item]));
      const arrows = state.project.arrows.map((arrow) => ({
        ...arrow,
        fromId: arrow.fromId === block.id ? created[0].id : arrow.fromId,
        toId: arrow.toId === block.id ? created[0].id : arrow.toId,
      }));
      return commit(state, syncProject({ ...state.project, blocks, arrows }));
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
      if (!endpointExists(state.project, action.arrow.fromId) || !endpointExists(state.project, action.arrow.toId)) {
        return state;
      }
      if (action.arrow.fromId === action.arrow.toId) return state;
      return commit(state, { ...state.project, arrows: [...state.project.arrows, action.arrow] });
    }
    case 'update-arrow': {
      let changed = false;
      const arrows = state.project.arrows.map((arrow) => {
        if (arrow.id !== action.id) return arrow;
        const next = { ...arrow, ...action.patch };
        if (next.label === arrow.label && next.style === arrow.style && next.color === arrow.color) return arrow;
        changed = true;
        return next;
      });
      if (!changed) return state;
      return commit(state, { ...state.project, arrows });
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
