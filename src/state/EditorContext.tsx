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
import { downloadJson } from '../lib/files';
import { projectFilename } from '../lib/filename';
import { GRID } from '../lib/layout';
import { blockIdsToMove } from '../lib/move';
import { createId } from '../lib/ids';
import { createEditorState, readStoredProject, reduce, type EditorState, type ToastState } from './editor';
import type { Arrow, Project } from '../types';

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
  tool: 'select' | 'arrow';
  arrowFrom: string | null;
  toast: ToastState | null;
  editingId: string | null;
  importOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  setViewport: Dispatch<SetStateAction<Viewport>>;
  setTool: (tool: 'select' | 'arrow') => void;
  setArrowFrom: (id: string | null) => void;
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
  addArrow: (fromId: string, toId: string) => void;
  updateArrow: (id: string, patch: Partial<Pick<Arrow, 'label' | 'style' | 'color'>>) => void;
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
  const [tool, setTool] = useState<'select' | 'arrow'>('select');
  const [arrowFrom, setArrowFrom] = useState<string | null>(null);
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
    ]);
    setSelection((current) => {
      const next = current.filter((id) => ids.has(id));
      return next.length === current.length ? current : next;
    });
    if (arrowFrom && !ids.has(arrowFrom)) setArrowFrom(null);
  }, [project, arrowFrom]);

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

  const addArrow = useCallback((fromId: string, toId: string) => {
    const arrow: Arrow = { id: createId('p'), fromId, toId, label: '', style: 'straight', color: null };
    dispatch({ type: 'add-arrow', arrow });
    setSelection([arrow.id]);
    setArrowFrom(null);
    setTool('select');
  }, []);

  const updateArrow = useCallback((id: string, patch: Partial<Pick<Arrow, 'label' | 'style' | 'color'>>) => {
    dispatch({ type: 'update-arrow', id, patch });
  }, []);

  const importText = useCallback((text: string, reference: string) => {
    dispatch({ type: 'import-text', text, reference });
    setSelection([]);
    setTool('select');
    setArrowFrom(null);
    setEditingId(null);
    setViewport({ x: 0, y: 0, zoom: 1 });
    setImportOpen(false);
  }, []);

  const loadProject = useCallback((next: Project) => {
    dispatch({ type: 'load', project: next });
    setSelection([]);
    setTool('select');
    setArrowFrom(null);
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
      arrowFrom,
      toast: state.toast,
      editingId,
      importOpen,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      setViewport,
      setTool,
      setArrowFrom,
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
      addArrow,
      updateArrow,
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
      arrowFrom,
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
      addArrow,
      updateArrow,
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
        if (current.arrowFrom || current.tool === 'arrow') {
          current.setArrowFrom(null);
          current.setTool('select');
          return;
        }
        if (current.selection.length) current.setSelection([]);
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
