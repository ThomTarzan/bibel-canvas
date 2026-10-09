import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { RELATIONS } from '../lib/catalog';
import { downloadJson } from '../lib/files';
import { projectFilename } from '../lib/filename';
import { GRID } from '../lib/layout';
import { blockIdsToMove } from '../lib/move';
import { createId } from '../lib/ids';
import { nextFrameColor } from '../lib/project';
import { createEditorState, readStoredProject, reduce, type EditorState, type ToastState } from './editor';
import type {
  Arrow,
  ArrowEnd,
  ConnectorKind,
  ExportPrefs,
  FontFamilyId,
  FrameStyle,
  LogicRole,
  Project,
  RelationId,
  TypographySettings,
} from '../types';

export type CanvasTool = 'select' | 'arrow' | 'connector';

const STORAGE_KEY = 'bibel-canvas:v1';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface EditorApi {
  project: Project;
  viewport: Viewport;
  selection: string[];
  tool: CanvasTool;
  relation: RelationId | null;
  connectorKind: ConnectorKind;
  toast: ToastState | null;
  editingId: string | null;
  importOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  setViewport: Dispatch<SetStateAction<Viewport>>;
  setTool: (tool: CanvasTool) => void;
  armRelation: (id: RelationId | null) => void;
  armConnector: (kind: ConnectorKind) => void;
  setEditingId: (id: string | null) => void;
  setSelection: Dispatch<SetStateAction<string[]>>;
  setImportOpen: (open: boolean) => void;
  importText: (text: string, reference: string) => void;
  undo: () => void;
  redo: () => void;
  deleteIds: (ids: string[]) => void;
  deleteSelection: () => void;
  deleteAllNumbers: () => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  mergeSelection: () => void;
  splitSelection: () => void;
  commitMove: (positions: { id: string; x: number; y: number }[]) => void;
  setBlockText: (id: string, text: string) => void;
  setFill: (color: string | null) => void;
  setTextColor: (color: string | null) => void;
  setGroupFill: (color: string | null) => void;
  setArrowColor: (color: string | null) => void;
  addDrawnArrow: (from: ArrowEnd, to: ArrowEnd, relation?: RelationId | null) => void;
  addDrawnConnector: (from: ArrowEnd, to: ArrowEnd, kind?: ConnectorKind) => void;
  updateArrow: (id: string, patch: Partial<Pick<Arrow, 'label' | 'style' | 'color' | 'relation' | 'from' | 'to'>>) => void;
  updateConnectorEnd: (id: string, which: 'from' | 'to', end: ArrowEnd) => void;
  addInnskutt: () => void;
  toggleHovedpastand: () => void;
  setRole: (role: LogicRole | null) => void;
  setRoleHidden: (hidden: boolean) => void;
  toggleRoleIcons: () => void;
  toggleRelationLegend: () => void;
  toggleFrameLegend: () => void;
  toggleCommentsVisible: () => void;
  addComment: () => void;
  updateComment: (id: string, patch: Partial<{ text: string; minimized: boolean; x: number; y: number }>) => void;
  setTypography: (patch: Partial<TypographySettings>) => void;
  setBlockFont: (patch: { fontFamily?: FontFamilyId | null; fontSize?: number | null; fontWeight?: number | null }) => void;
  applyFrame: (colorId: string, thickness: number, style: FrameStyle) => void;
  clearFrames: () => void;
  addFrameColor: () => void;
  updateFrameColor: (id: string, patch: Partial<{ name: string; color: string }>) => void;
  deleteFrameColor: (id: string) => void;
  setExportPrefs: (patch: Partial<ExportPrefs>) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setReference: (reference: string) => void;
  loadProject: (project: Project) => void;
  dismissToast: () => void;
  notify: (message: string) => void;
  registerCanvas: (element: HTMLElement | null) => void;
  zoomBy: (factor: number) => void;
  resetZoom: () => void;
  saveProject: () => void;
}

const EditorContext = createContext<EditorApi | null>(null);

function loadInitial(): EditorState {
  if (typeof localStorage === 'undefined') return createEditorState();
  return createEditorState(readStoredProject(localStorage.getItem(STORAGE_KEY)) ?? undefined);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, loadInitial);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [selection, setSelection] = useState<string[]>([]);
  const [tool, setTool] = useState<CanvasTool>('select');
  const [relation, setRelation] = useState<RelationId | null>('årsak');
  const [connectorKind, setConnectorKind] = useState<ConnectorKind>('apposisjon');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const canvasRef = useRef<HTMLElement | null>(null);
  const apiRef = useRef<EditorApi | null>(null);

  const { project } = state;

  useEffect(() => {
    const ids = new Set<string>([
      ...project.blocks.map((block) => block.id),
      ...project.groups.map((group) => group.id),
      ...project.arrows.map((arrow) => arrow.id),
      ...project.connectors.map((connector) => connector.id),
      ...project.markers.map((marker) => marker.id),
      ...project.comments.map((comment) => comment.id),
    ]);
    setSelection((current) => {
      const next = current.filter((id) => ids.has(id));
      return next.length === current.length ? current : next;
    });
  }, [project]);

  useEffect(() => {
    if (editingId && !project.blocks.some((block) => block.id === editingId)) setEditingId(null);
  }, [project, editingId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch {
        // A full disk should not take the canvas down with it.
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [project]);

  const selectedBlocks = project.blocks.filter((block) => selection.includes(block.id));
  const selectedGroupIds = selection.filter((id) => project.groups.some((group) => group.id === id));

  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const deleteIds = useCallback((ids: string[]) => dispatch({ type: 'delete-ids', ids }), []);
  const deleteSelection = useCallback(() => dispatch({ type: 'delete-ids', ids: selection }), [selection]);
  const deleteAllNumbers = useCallback(() => dispatch({ type: 'delete-all-numbers' }), []);
  const commitMove = useCallback(
    (positions: { id: string; x: number; y: number }[]) => dispatch({ type: 'commit-move', positions }),
    [],
  );
  const setBlockText = useCallback((id: string, text: string) => dispatch({ type: 'set-text', id, text }), []);
  const toggleGrid = useCallback(() => dispatch({ type: 'toggle-grid' }), []);
  const toggleSnap = useCallback(() => dispatch({ type: 'toggle-snap' }), []);
  const setReference = useCallback((reference: string) => dispatch({ type: 'set-reference', reference }), []);
  const dismissToast = useCallback(() => dispatch({ type: 'set-toast', toast: null }), []);
  const notify = useCallback(
    (message: string) => dispatch({ type: 'set-toast', toast: { message, offerUndo: false } }),
    [],
  );

  const groupSelection = useCallback(() => {
    dispatch({ type: 'group', blockIds: selectedBlocks.map((block) => block.id) });
  }, [selectedBlocks]);

  const ungroupSelection = useCallback(() => {
    dispatch({
      type: 'ungroup',
      groupIds: selectedGroupIds,
      blockIds: selectedBlocks.map((block) => block.id),
    });
  }, [selectedBlocks, selectedGroupIds]);

  const mergeSelection = useCallback(() => {
    dispatch({ type: 'merge', blockIds: selectedBlocks.map((block) => block.id) });
  }, [selectedBlocks]);

  const splitSelection = useCallback(() => {
    if (selectedBlocks.length === 1) dispatch({ type: 'split', blockId: selectedBlocks[0].id });
  }, [selectedBlocks]);

  const applyFill = useCallback(
    (color: string | null) => {
      const blockIds = selectedBlocks.map((block) => block.id);
      if (blockIds.length) dispatch({ type: 'set-fill', blockIds, color });
    },
    [selectedBlocks],
  );
  const applyTextColor = useCallback(
    (color: string | null) => {
      const blockIds = selectedBlocks.map((block) => block.id);
      if (blockIds.length) dispatch({ type: 'set-text-color', blockIds, color });
    },
    [selectedBlocks],
  );
  const applyGroupFill = useCallback(
    (color: string | null) => {
      const groupIds = new Set<string>(selectedGroupIds);
      for (const block of selectedBlocks) if (block.groupId) groupIds.add(block.groupId);
      if (groupIds.size) dispatch({ type: 'set-group-fill', groupIds: [...groupIds], color });
    },
    [selectedBlocks, selectedGroupIds],
  );
  const applyArrowColor = useCallback(
    (color: string | null) => {
      const arrowIds = selection.filter((id) => project.arrows.some((arrow) => arrow.id === id));
      if (arrowIds.length) dispatch({ type: 'set-arrow-color', arrowIds, color });
    },
    [project.arrows, selection],
  );

  const armRelation = useCallback((id: RelationId | null) => {
    setRelation(id);
    setTool((current) => (current === 'arrow' && relation === id ? 'select' : 'arrow'));
  }, [relation]);

  const armConnector = useCallback((kind: ConnectorKind) => {
    setConnectorKind(kind);
    setTool((current) => (current === 'connector' && connectorKind === kind ? 'select' : 'connector'));
  }, [connectorKind]);

  const addDrawnArrow = useCallback((from: ArrowEnd, to: ArrowEnd, usedRelation?: RelationId | null) => {
    const arrow: Arrow = {
      id: createId('p'),
      fromId: from.targetId ?? '',
      toId: to.targetId ?? '',
      label: '',
      style: 'straight',
      color: null,
      relation: usedRelation === undefined ? relation : usedRelation,
      from,
      to,
    };
    dispatch({ type: 'add-arrow', arrow });
    setSelection([arrow.id]);
  }, [relation]);

  const addDrawnConnector = useCallback((from: ArrowEnd, to: ArrowEnd, kind?: ConnectorKind) => {
    const id = createId('k');
    dispatch({
      type: 'add-connector',
      connector: { id, kind: kind ?? connectorKind, fromId: from.targetId ?? '', toId: to.targetId ?? '', from, to },
    });
    setSelection([id]);
  }, [connectorKind]);

  const updateArrow = useCallback((id: string, patch: Partial<Pick<Arrow, 'label' | 'style' | 'color' | 'relation' | 'from' | 'to'>>) => {
    dispatch({ type: 'update-arrow', id, patch });
  }, []);

  const updateConnectorEnd = useCallback((id: string, which: 'from' | 'to', end: ArrowEnd) => {
    dispatch({ type: 'update-connector', id, patch: { [which]: end } });
  }, []);

  const markerTargets = useCallback(() => {
    const ids: string[] = [];
    for (const id of selection) {
      if (project.blocks.some((block) => block.id === id) || project.groups.some((group) => group.id === id)) ids.push(id);
    }
    return ids;
  }, [project.blocks, project.groups, selection]);

  const addInnskutt = useCallback(() => {
    const targetIds = markerTargets();
    if (targetIds.length === 0) {
      dispatch({ type: 'set-toast', toast: { message: 'Velg ord, en frase eller en gruppe først.', offerUndo: false } });
      return;
    }
    const id = createId('m');
    dispatch({ type: 'add-marker', marker: { id, kind: 'innskutt', targetIds } });
    setSelection([id]);
  }, [markerTargets]);

  const toggleHovedpastand = useCallback(() => {
    const targetIds = markerTargets();
    if (targetIds.length === 0) {
      dispatch({ type: 'set-toast', toast: { message: 'Velg et ord eller en gruppe først.', offerUndo: false } });
      return;
    }
    dispatch({ type: 'toggle-hovedpastand', targetIds });
  }, [markerTargets]);

  const roleBlockIds = useCallback(() => {
    const ids = new Set(selectedBlocks.map((block) => block.id));
    for (const groupId of selectedGroupIds) {
      project.groups.find((group) => group.id === groupId)?.blockIds.forEach((id) => ids.add(id));
    }
    return [...ids];
  }, [project.groups, selectedBlocks, selectedGroupIds]);

  const setRole = useCallback((role: LogicRole | null) => {
    const blockIds = roleBlockIds();
    if (blockIds.length) dispatch({ type: 'set-role', blockIds, role });
  }, [roleBlockIds]);

  const setRoleHidden = useCallback((hidden: boolean) => {
    const blockIds = roleBlockIds();
    if (blockIds.length) dispatch({ type: 'set-role-hidden', blockIds, hidden });
  }, [roleBlockIds]);

  const addComment = useCallback(() => {
    const block = project.blocks.find((item) => selection.includes(item.id));
    const group = project.groups.find((item) => selection.includes(item.id));
    const arrow = project.arrows.find((item) => selection.includes(item.id));
    const connector = project.connectors.find((item) => selection.includes(item.id));
    const targetId = block?.id ?? group?.id ?? arrow?.id ?? connector?.id;
    if (!targetId) {
      dispatch({ type: 'set-toast', toast: { message: 'Velg et ord, en gruppe eller en pil først.', offerUndo: false } });
      return;
    }
    if (!project.showComments) dispatch({ type: 'toggle-comments-visible' });
    dispatch({
      type: 'add-comment',
      comment: { id: createId('c'), targetId, x: 12, y: -6, text: '', minimized: false, anchored: true },
    });
  }, [project.arrows, project.blocks, project.connectors, project.groups, project.showComments, selection]);

  const updateComment = useCallback((id: string, patch: Partial<{ text: string; minimized: boolean; x: number; y: number }>) => {
    dispatch({ type: 'update-comment', id, patch });
  }, []);

  const setTypography = useCallback((patch: Partial<TypographySettings>) => {
    dispatch({ type: 'set-typography', patch });
  }, []);

  const setBlockFont = useCallback((patch: { fontFamily?: FontFamilyId | null; fontSize?: number | null; fontWeight?: number | null }) => {
    const blockIds = selectedBlocks.map((block) => block.id);
    if (blockIds.length) dispatch({ type: 'set-block-font', blockIds, patch });
  }, [selectedBlocks]);

  const applyFrame = useCallback((colorId: string, thickness: number, style: FrameStyle) => {
    const targetIds = markerTargets();
    if (targetIds.length) dispatch({ type: 'set-frames', targetIds, colorId, thickness, style });
  }, [markerTargets]);

  const clearFrames = useCallback(() => {
    const targetIds = markerTargets();
    if (targetIds.length) dispatch({ type: 'clear-frames', targetIds });
  }, [markerTargets]);

  const addFrameColor = useCallback(() => {
    dispatch({
      type: 'add-frame-color',
      id: createId('ramme'),
      color: nextFrameColor(project.frameColors),
      name: '',
    });
  }, [project.frameColors]);

  const updateFrameColor = useCallback((id: string, patch: Partial<{ name: string; color: string }>) => {
    dispatch({ type: 'update-frame-color', id, patch });
  }, []);

  const deleteFrameColor = useCallback((id: string) => {
    dispatch({ type: 'delete-frame-color', id });
  }, []);

  const setExportPrefs = useCallback((patch: Partial<ExportPrefs>) => {
    dispatch({ type: 'set-export-prefs', patch });
  }, []);

  const toggleRoleIcons = useCallback(() => dispatch({ type: 'toggle-role-icons' }), []);
  const toggleRelationLegend = useCallback(() => dispatch({ type: 'toggle-relation-legend' }), []);
  const toggleFrameLegend = useCallback(() => dispatch({ type: 'toggle-frame-legend' }), []);
  const toggleCommentsVisible = useCallback(() => dispatch({ type: 'toggle-comments-visible' }), []);

  const importText = useCallback((text: string, reference: string) => {
    dispatch({ type: 'import-text', text, reference });
    setSelection([]);
    setTool('select');
    setEditingId(null);
    setViewport({ x: 0, y: 0, zoom: 1 });
    setImportOpen(false);
  }, []);

  const loadProject = useCallback((next: Project) => {
    dispatch({ type: 'load', project: next });
    setSelection([]);
    setTool('select');
    setEditingId(null);
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, []);

  const registerCanvas = useCallback((element: HTMLElement | null) => {
    canvasRef.current = element;
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    setViewport((current) => {
      const zoom = clamp(current.zoom * factor, 0.25, 2.5);
      const mx = (rect?.width ?? 0) / 2;
      const my = (rect?.height ?? 0) / 2;
      const worldX = (mx - current.x) / current.zoom;
      const worldY = (my - current.y) / current.zoom;
      return { zoom, x: mx - worldX * zoom, y: my - worldY * zoom };
    });
  }, []);

  const resetZoom = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    setViewport((current) => {
      const zoom = 1;
      const mx = (rect?.width ?? 0) / 2;
      const my = (rect?.height ?? 0) / 2;
      const worldX = (mx - current.x) / current.zoom;
      const worldY = (my - current.y) / current.zoom;
      return { zoom, x: mx - worldX * zoom, y: my - worldY * zoom };
    });
  }, []);

  const saveProject = useCallback(() => {
    downloadJson(projectFilename(project.reference, new Date()), project);
  }, [project]);

  const api = useMemo<EditorApi>(
    () => ({
      project,
      viewport,
      selection,
      tool,
      relation,
      connectorKind,
      toast: state.toast,
      editingId,
      importOpen,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      setViewport,
      setTool,
      armRelation,
      armConnector,
      setEditingId,
      setSelection,
      setImportOpen,
      importText,
      undo,
      redo,
      deleteIds,
      deleteSelection,
      deleteAllNumbers,
      groupSelection,
      ungroupSelection,
      mergeSelection,
      splitSelection,
      commitMove,
      setBlockText,
      setFill: applyFill,
      setTextColor: applyTextColor,
      setGroupFill: applyGroupFill,
      setArrowColor: applyArrowColor,
      addDrawnArrow,
      addDrawnConnector,
      updateArrow,
      updateConnectorEnd,
      addInnskutt,
      toggleHovedpastand,
      setRole,
      setRoleHidden,
      toggleRoleIcons,
      toggleRelationLegend,
      toggleFrameLegend,
      toggleCommentsVisible,
      addComment,
      updateComment,
      setTypography,
      setBlockFont,
      applyFrame,
      clearFrames,
      addFrameColor,
      updateFrameColor,
      deleteFrameColor,
      setExportPrefs,
      toggleGrid,
      toggleSnap,
      setReference,
      loadProject,
      dismissToast,
      notify,
      registerCanvas,
      zoomBy,
      resetZoom,
      saveProject,
    }),
    [
      project,
      viewport,
      selection,
      tool,
      relation,
      connectorKind,
      state.toast,
      state.past.length,
      state.future.length,
      editingId,
      importOpen,
      importText,
      undo,
      redo,
      deleteIds,
      deleteSelection,
      deleteAllNumbers,
      groupSelection,
      ungroupSelection,
      mergeSelection,
      splitSelection,
      commitMove,
      setBlockText,
      applyFill,
      applyTextColor,
      applyGroupFill,
      applyArrowColor,
      addDrawnArrow,
      addDrawnConnector,
      updateArrow,
      updateConnectorEnd,
      addInnskutt,
      toggleHovedpastand,
      setRole,
      setRoleHidden,
      toggleRoleIcons,
      toggleRelationLegend,
      toggleFrameLegend,
      toggleCommentsVisible,
      addComment,
      updateComment,
      setTypography,
      setBlockFont,
      applyFrame,
      clearFrames,
      addFrameColor,
      updateFrameColor,
      deleteFrameColor,
      setExportPrefs,
      armRelation,
      armConnector,
      toggleGrid,
      toggleSnap,
      setReference,
      loadProject,
      dismissToast,
      notify,
      registerCanvas,
      zoomBy,
      resetZoom,
      saveProject,
    ],
  );

  apiRef.current = api;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const current = apiRef.current;
      if (!current || current.importOpen || isTypingTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) current.redo();
        else current.undo();
        return;
      }
      if (mod && key === 'y') {
        event.preventDefault();
        current.redo();
        return;
      }
      if (mod && key === 's') {
        event.preventDefault();
        current.saveProject();
        return;
      }
      if (mod && key === 'a') {
        event.preventDefault();
        current.setSelection(current.project.blocks.map((block) => block.id));
        return;
      }
      if (mod && key === 'g') {
        event.preventDefault();
        if (event.shiftKey) current.ungroupSelection();
        else current.groupSelection();
        return;
      }
      if (event.key === 'Escape') {
        if (current.editingId) {
          current.setEditingId(null);
          return;
        }
        if (current.tool !== 'select') {
          current.setTool('select');
          return;
        }
        if (current.selection.length) current.setSelection([]);
        return;
      }
      if (!mod && /^[1-8]$/.test(event.key)) {
        const next = RELATIONS[Number(event.key) - 1];
        const only = current.selection.length === 1 ? current.selection[0] : null;
        const arrow = only ? current.project.arrows.find((item) => item.id === only) : undefined;
        if (arrow) current.updateArrow(arrow.id, { relation: next.id });
        else current.armRelation(next.id);
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (current.selection.length === 0) return;
        event.preventDefault();
        current.deleteSelection();
        return;
      }
      if (event.key.startsWith('Arrow')) {
        const ids = blockIdsToMove(current.project, current.selection);
        if (ids.length === 0) return;
        event.preventDefault();
        const step = event.shiftKey || current.project.snap ? GRID : 4;
        const delta = { x: 0, y: 0 };
        if (event.key === 'ArrowLeft') delta.x = -step;
        if (event.key === 'ArrowRight') delta.x = step;
        if (event.key === 'ArrowUp') delta.y = -step;
        if (event.key === 'ArrowDown') delta.y = step;
        const primary = current.project.blocks.find((block) => block.id === ids[0]);
        if (!primary) return;
        let nextX = primary.x + delta.x;
        let nextY = primary.y + delta.y;
        if (current.project.snap) {
          nextX = Math.round(nextX / GRID) * GRID;
          nextY = Math.round(nextY / GRID) * GRID;
        }
        const dx = nextX - primary.x;
        const dy = nextY - primary.y;
        if (dx === 0 && dy === 0) return;
        current.commitMove(
          ids.flatMap((id) => {
            const block = current.project.blocks.find((item) => item.id === id);
            return block ? [{ id, x: block.x + dx, y: block.y + dy }] : [];
          }),
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <EditorContext.Provider value={api}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorApi {
  const value = useContext(EditorContext);
  if (!value) throw new Error('EditorContext mangler');
  return value;
}
