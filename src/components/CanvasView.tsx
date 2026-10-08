import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  arrowGeometry,
  blockRect,
  boundsOf,
  distanceToArrow,
  intersects,
  type Rect,
} from '../lib/geometry';
import { BLOCK_H, GRID } from '../lib/layout';
import { measureTextWidth } from '../lib/measure';
import { blockIdsToMove } from '../lib/move';
import { useEditor, type Viewport } from '../state/EditorContext';
import type { Block, Project } from '../types';

const GROUP_PAD = 14;

type DragInteraction = {
  type: 'drag';
  pointerId: number;
  startClientX: number;
  startClientY: number;
  origin: Record<string, { x: number; y: number }>;
  ids: string[];
  dx: number;
  dy: number;
  moved: boolean;
};

type MarqueeInteraction = {
  type: 'marquee';
  pointerId: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  shift: boolean;
  base: string[];
  moved: boolean;
};

type PanInteraction = {
  type: 'pan';
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
};

type Interaction = DragInteraction | MarqueeInteraction | PanInteraction;

function clientToWorld(clientX: number, clientY: number, rect: DOMRect, viewport: Viewport) {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.zoom,
    y: (clientY - rect.top - viewport.y) / viewport.zoom,
  };
}

function placeOf(block: Block, drag: DragInteraction | null): { x: number; y: number } {
  const origin = drag?.origin[block.id];
  if (!origin) return { x: block.x, y: block.y };
  return { x: origin.x + drag.dx, y: origin.y + drag.dy };
}

function rectFor(project: Project, id: string, drag: DragInteraction | null): Rect | null {
  const block = project.blocks.find((item) => item.id === id);
  if (block) {
    const point = placeOf(block, drag);
    return blockRect(point.x, point.y, measureTextWidth(block.text));
  }
  const group = project.groups.find((item) => item.id === id);
  if (!group) return null;
  const rects = group.blockIds.flatMap((blockId) => {
    const child = project.blocks.find((item) => item.id === blockId);
    if (!child) return [];
    const point = placeOf(child, drag);
    return [blockRect(point.x, point.y, measureTextWidth(child.text))];
  });
  return boundsOf(rects, GROUP_PAD);
}

export function CanvasView() {
  const api = useEditor();
  const rootRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef(api);
  const viewportRef = useRef(api.viewport);
  const spaceRef = useRef(false);
  const interactionRef = useRef<Interaction | null>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [space, setSpace] = useState(false);
  const [draftText, setDraftText] = useState('');
  const cancelEdit = useRef(false);

  apiRef.current = api;
  viewportRef.current = api.viewport;

  const setInteractionBoth = (next: Interaction | null) => {
    interactionRef.current = next;
    setInteraction(next);
  };

  useEffect(() => {
    api.registerCanvas(rootRef.current);
    return () => api.registerCanvas(null);
  }, [api.registerCanvas]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = root.getBoundingClientRect();
      const current = viewportRef.current;
      const scale = event.deltaMode === 1 ? 16 : 1;
      if (event.ctrlKey || event.metaKey) {
        const zoom = Math.min(2.5, Math.max(0.25, current.zoom * Math.exp(-event.deltaY * scale * 0.0016)));
        const mx = event.clientX - rect.left;
        const my = event.clientY - rect.top;
        const worldX = (mx - current.x) / current.zoom;
        const worldY = (my - current.y) / current.zoom;
        apiRef.current.setViewport({ zoom, x: mx - worldX * zoom, y: my - worldY * zoom });
      } else {
        apiRef.current.setViewport({
          ...current,
          x: current.x - event.deltaX * scale,
          y: current.y - event.deltaY * scale,
        });
      }
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      event.preventDefault();
      spaceRef.current = true;
      setSpace(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      spaceRef.current = false;
      setSpace(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const finish = (event: PointerEvent) => {
      const current = interactionRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      interactionRef.current = null;
      setInteraction(null);
      const editor = apiRef.current;
      if (current.type === 'drag' && current.moved) {
        editor.commitMove(
          current.ids.flatMap((id) => {
            const origin = current.origin[id];
            return origin ? [{ id, x: origin.x + current.dx, y: origin.y + current.dy }] : [];
          }),
        );
      }
      if (current.type === 'marquee' && !current.moved && !current.shift) editor.setSelection([]);
    };

    const move = (event: PointerEvent) => {
      const current = interactionRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const editor = apiRef.current;
      const viewport = viewportRef.current;
      if (current.type === 'pan') {
        editor.setViewport({
          ...viewport,
          x: current.originX + (event.clientX - current.startClientX),
          y: current.originY + (event.clientY - current.startClientY),
        });
        return;
      }
      if (current.type === 'drag') {
        const rawDx = (event.clientX - current.startClientX) / viewport.zoom;
        const rawDy = (event.clientY - current.startClientY) / viewport.zoom;
        const primary = current.origin[current.ids[0] ?? ''];
        let dx = rawDx;
        let dy = rawDy;
        if (editor.project.snap && primary) {
          dx = Math.round((primary.x + rawDx) / GRID) * GRID - primary.x;
          dy = Math.round((primary.y + rawDy) / GRID) * GRID - primary.y;
        }
        const next: DragInteraction = {
          ...current,
          dx,
          dy,
          moved: current.moved || Math.hypot(event.clientX - current.startClientX, event.clientY - current.startClientY) > 3,
        };
        interactionRef.current = next;
        setInteraction(next);
        return;
      }
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const world = clientToWorld(event.clientX, event.clientY, rect, viewport);
      const moved = current.moved || Math.hypot(world.x - current.x0, world.y - current.y0) > 3;
      const box: Rect = {
        x: Math.min(current.x0, world.x),
        y: Math.min(current.y0, world.y),
        w: Math.abs(world.x - current.x0),
        h: Math.abs(world.y - current.y0),
      };
      const hits = editor.project.blocks
        .filter((block) => intersects(box, blockRect(block.x, block.y, measureTextWidth(block.text))))
        .map((block) => block.id);
      editor.setSelection(current.shift ? [...new Set([...current.base, ...hits])] : hits);
      const next: MarqueeInteraction = { ...current, x1: world.x, y1: world.y, moved };
      interactionRef.current = next;
      setInteraction(next);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, []);

  const drag = interaction?.type === 'drag' ? interaction : null;

  const beginPan = (event: ReactPointerEvent) => {
    const viewport = viewportRef.current;
    setInteractionBoth({
      type: 'pan',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    });
  };

  const beginOnElement = (event: ReactPointerEvent, id: string) => {
    if (event.button === 1 || spaceRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, button')) return;
    event.stopPropagation();
    const editor = apiRef.current;
    if (editor.tool === 'arrow') {
      if (!editor.arrowFrom) editor.setArrowFrom(id);
      else if (editor.arrowFrom !== id) editor.addArrow(editor.arrowFrom, id);
      return;
    }
    if (event.shiftKey && editor.selection.includes(id)) {
      editor.setSelection(editor.selection.filter((item) => item !== id));
      return;
    }
    const next = event.shiftKey ? [...editor.selection, id] : editor.selection.includes(id) ? editor.selection : [id];
    editor.setSelection(next);
    const ids = blockIdsToMove(editor.project, next);
    const origin: Record<string, { x: number; y: number }> = {};
    for (const blockId of ids) {
      const block = editor.project.blocks.find((item) => item.id === blockId);
      if (block) origin[blockId] = { x: block.x, y: block.y };
    }
    if (ids.length === 0) return;
    setInteractionBoth({
      type: 'drag',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origin,
      ids,
      dx: 0,
      dy: 0,
      moved: false,
    });
  };

  const onBackgroundPointerDown = (event: ReactPointerEvent) => {
    if (event.button === 1 || spaceRef.current || event.pointerType === 'touch') {
      event.preventDefault();
      beginPan(event);
      return;
    }
    if (event.button !== 0) return;
    const editor = apiRef.current;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = clientToWorld(event.clientX, event.clientY, rect, viewportRef.current);
    if (editor.tool === 'arrow') return;

    let hitArrow: string | null = null;
    let best = 8 / viewportRef.current.zoom;
    for (const arrow of editor.project.arrows) {
      const from = rectFor(editor.project, arrow.fromId, null);
      const to = rectFor(editor.project, arrow.toId, null);
      if (!from || !to) continue;
      const geom = arrowGeometry(from, to, arrow.style);
      if (!geom) continue;
      const distance = distanceToArrow(world.x, world.y, geom);
      if (distance <= best) {
        best = distance;
        hitArrow = arrow.id;
      }
    }
    if (hitArrow) {
      editor.setSelection(event.shiftKey && editor.selection.includes(hitArrow)
        ? editor.selection.filter((id) => id !== hitArrow)
        : event.shiftKey
          ? [...editor.selection, hitArrow]
          : [hitArrow]);
      return;
    }

    setInteractionBoth({
      type: 'marquee',
      pointerId: event.pointerId,
      x0: world.x,
      y0: world.y,
      x1: world.x,
      y1: world.y,
      shift: event.shiftKey,
      base: event.shiftKey ? editor.selection : [],
      moved: false,
    });
  };

  const gridStyle = api.project.grid
    ? {
        backgroundImage: 'radial-gradient(circle, #cfc6b8 0.95px, transparent 1.05px)',
        backgroundSize: `${GRID * api.viewport.zoom}px ${GRID * api.viewport.zoom}px`,
        backgroundPosition: `${api.viewport.x}px ${api.viewport.y}px`,
      }
    : undefined;

  const marquee = interaction?.type === 'marquee' && interaction.moved ? interaction : null;
  const uncertain = api.project.blocks.some((block) => block.uncertain);
  const hint =
    api.selection.length > 0
      ? ''
      : api.tool === 'arrow'
        ? api.arrowFrom
          ? 'Klikk sluttpunktet for pilen. Esc avbryter.'
          : 'Klikk startpunktet for pilen.'
        : uncertain
          ? 'Stiplede tall er usikre. Klikk × for å fjerne dem.'
          : api.project.blocks.length > 0
            ? 'Mellomrom og dra for å flytte lerretet. Ctrl og rullehjul zoomer. Dobbeltklikk redigerer.'
            : '';

  return (
    <div
      ref={rootRef}
      className={['canvas', space ? 'space' : '', interaction?.type === 'pan' ? 'panning' : '', api.tool === 'arrow' ? 'arrow-tool' : '']
        .filter(Boolean)
        .join(' ')}
      onPointerDown={onBackgroundPointerDown}
      onContextMenu={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
    >
      <div className="grid-layer" style={gridStyle} />
      <div
        className="world"
        style={{
          transform: `translate(${api.viewport.x}px, ${api.viewport.y}px) scale(${api.viewport.zoom})`,
        }}
      >
        {api.project.groups.map((group) => {
          const rect = rectFor(api.project, group.id, drag);
          if (!rect) return null;
          const selected = api.selection.includes(group.id);
          return (
            <div
              key={group.id}
              className={selected ? 'group selected' : 'group'}
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                background: group.fill ?? undefined,
              }}
              onPointerDown={(event) => beginOnElement(event, group.id)}
            />
          );
        })}
        <svg className="arrow-layer">
          {api.project.arrows.map((arrow) => {
            const from = rectFor(api.project, arrow.fromId, drag);
            const to = rectFor(api.project, arrow.toId, drag);
            if (!from || !to) return null;
            const geom = arrowGeometry(from, to, arrow.style);
            if (!geom) return null;
            const selected = api.selection.includes(arrow.id);
            const color = arrow.color ?? '#5c675f';
            return (
              <g key={arrow.id} className={selected ? 'arrow selected' : 'arrow'}>
                <path
                  d={geom.d}
                  fill="none"
                  stroke={color}
                  strokeWidth={selected ? 2.2 : 1.5}
                  strokeDasharray={arrow.style === 'dashed' ? '6 6' : undefined}
                  strokeLinecap="round"
                />
                <path d={geom.head} fill={color} />
              </g>
            );
          })}
        </svg>
        {api.project.blocks.map((block) => {
          const point = placeOf(block, drag);
          const editing = api.editingId === block.id;
          const width = measureTextWidth(editing ? draftText || block.text : block.text);
          const selected = api.selection.includes(block.id);
          return (
            <div
              key={block.id}
              className={[
                'block',
                selected ? 'selected' : '',
                block.kind === 'number' ? 'number' : '',
                block.uncertain ? 'uncertain' : '',
                api.arrowFrom === block.id ? 'endpoint' : '',
                editing ? 'editing' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                left: point.x,
                top: point.y,
                width,
                height: BLOCK_H,
                background: block.fill ?? undefined,
                color: block.textColor ?? undefined,
              }}
              title={block.uncertain ? 'Usikkert tall' : undefined}
              onPointerDown={(event) => beginOnElement(event, block.id)}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (api.tool === 'arrow') return;
                cancelEdit.current = false;
                setDraftText(block.text);
                api.setEditingId(block.id);
              }}
            >
              {editing ? (
                <input
                  className="block-edit"
                  value={draftText}
                  autoFocus
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => setDraftText(event.target.value)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      cancelEdit.current = true;
                      api.setBlockText(block.id, draftText);
                      api.setEditingId(null);
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      cancelEdit.current = true;
                      api.setEditingId(null);
                    }
                  }}
                  onBlur={() => {
                    if (cancelEdit.current) {
                      cancelEdit.current = false;
                      return;
                    }
                    api.setBlockText(block.id, draftText);
                    api.setEditingId(null);
                  }}
                />
              ) : (
                <span>{block.text}</span>
              )}
              {block.kind === 'number' && !editing && (
                <button
                  type="button"
                  className="num-x"
                  aria-label="Slett tall"
                  title={block.uncertain ? 'Usikkert tall — slett' : 'Slett tall'}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    api.deleteIds([block.id]);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {api.project.arrows.map((arrow) => {
          if (!arrow.label) return null;
          const from = rectFor(api.project, arrow.fromId, drag);
          const to = rectFor(api.project, arrow.toId, drag);
          if (!from || !to) return null;
          const geom = arrowGeometry(from, to, arrow.style);
          if (!geom) return null;
          return (
            <div
              key={`${arrow.id}-label`}
              className={api.selection.includes(arrow.id) ? 'arrow-label selected' : 'arrow-label'}
              style={{ left: geom.labelX, top: geom.labelY, color: arrow.color ?? undefined }}
              onPointerDown={(event) => {
                event.stopPropagation();
                api.setSelection([arrow.id]);
              }}
            >
              {arrow.label}
            </div>
          );
        })}
        {marquee && (
          <div
            className="marquee"
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
            }}
          />
        )}
      </div>
      {api.project.blocks.length === 0 && (
        <div className="empty">
          <h1>Lim inn en bibeltekst for å begynne</h1>
          <p>Ingen fast metode. Flytt, grupper og bind sammen ordene slik du vil.</p>
          <button
            type="button"
            className="btn primary"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => api.setImportOpen(true)}
          >
            Importer tekst
          </button>
        </div>
      )}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
