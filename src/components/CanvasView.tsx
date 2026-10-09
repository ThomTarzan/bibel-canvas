import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { relationCaption, CONNECTORS, LOGIC_ROLES } from '../lib/catalog';
import { ARROW_OUTLINE } from '../lib/colors';
import { fontFamilyCss, projectFont } from '../lib/fonts';
import { blockArrowPolygon, hitsBlockArrow, labelGap, labelPose, polygonPath } from '../lib/arrowShape';
import { distanceToSegment, intersects, type Rect } from '../lib/geometry';
import { BLOCK_H, GRID } from '../lib/layout';
import { blockIdsToMove } from '../lib/move';
import {
  MAGNET_DISTANCE,
  blockHeight,
  blockRectOf,
  commentOrigin,
  groupRectOf,
  linkPoints,
  markerBounds,
  snapTargets,
  targetRect,
  type PlaceFn,
} from '../lib/scene';
import { endFromMagnet, findMagnet } from '../lib/snap';
import { useEditor, type Viewport } from '../state/EditorContext';
import type { ArrowEnd, Block, Comment, ConnectorKind, Project, RelationId } from '../types';
import { ColorPopover } from './ColorPopover';

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
  blockId: string | null;
  shift: boolean;
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

type DrawInteraction = {
  type: 'draw';
  pointerId: number;
  mode: 'arrow' | 'connector';
  relation: RelationId | null;
  connector: ConnectorKind;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type EndInteraction = {
  type: 'end';
  pointerId: number;
  item: 'arrow' | 'connector';
  id: string;
  which: 'from' | 'to';
  x: number;
  y: number;
};

type Interaction = DragInteraction | MarqueeInteraction | PanInteraction | DrawInteraction | EndInteraction;

function clientToWorld(clientX: number, clientY: number, rect: DOMRect, viewport: Viewport) {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.zoom,
    y: (clientY - rect.top - viewport.y) / viewport.zoom,
  };
}

function placeFor(drag: DragInteraction | null): PlaceFn | undefined {
  if (!drag) return undefined;
  return (id) => {
    const origin = drag.origin[id];
    return origin ? { x: origin.x + drag.dx, y: origin.y + drag.dy } : undefined;
  };
}

function withDraggedEnd(from: ArrowEnd, to: ArrowEnd, end: EndInteraction | null, id: string): { from: ArrowEnd; to: ArrowEnd } {
  if (!end || end.id !== id) return { from, to };
  const point: ArrowEnd = { x: end.x, y: end.y, targetId: null, edge: false };
  return end.which === 'from' ? { from: point, to } : { from, to: point };
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
  const [colorBlockId, setColorBlockId] = useState<string | null>(null);
  const cancelEdit = useRef(false);

  apiRef.current = api;
  viewportRef.current = api.viewport;

  const setInteractionBoth = (next: Interaction | null) => {
    interactionRef.current = next;
    setInteraction(next);
  };

  useEffect(() => {
    if (colorBlockId && !api.selection.includes(colorBlockId)) setColorBlockId(null);
  }, [api.selection, colorBlockId]);

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
      if (current.type === 'drag' && !current.moved && current.blockId && !current.shift && editor.tool === 'select') {
        if (editor.selection.length === 1 && editor.selection[0] === current.blockId) setColorBlockId(current.blockId);
      }
      if (current.type === 'marquee' && !current.moved && !current.shift) editor.setSelection([]);
      if (current.type === 'draw') {
        const distance = Math.hypot(current.x1 - current.x0, current.y1 - current.y0);
        if (distance < 16) return;
        const targets = snapTargets(editor.project);
        const from = endFromMagnet(findMagnet({ x: current.x0, y: current.y0 }, targets, MAGNET_DISTANCE), { x: current.x0, y: current.y0 });
        const to = endFromMagnet(findMagnet({ x: current.x1, y: current.y1 }, targets, MAGNET_DISTANCE), { x: current.x1, y: current.y1 });
        const placed = linkPoints(editor.project, from, to);
        if (Math.hypot(placed.b.x - placed.a.x, placed.b.y - placed.a.y) < 12) return;
        if (current.mode === 'connector') editor.addDrawnConnector(from, to, current.connector);
        else editor.addDrawnArrow(from, to, current.relation);
      }
      if (current.type === 'end') {
        const targets = snapTargets(editor.project);
        const end = endFromMagnet(findMagnet({ x: current.x, y: current.y }, targets, MAGNET_DISTANCE), { x: current.x, y: current.y });
        if (current.item === 'arrow') editor.updateArrow(current.id, { [current.which]: end });
        else editor.updateConnectorEnd(current.id, current.which, end);
      }
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
      const rect = rootRef.current?.getBoundingClientRect();
      if ((current.type === 'draw' || current.type === 'end') && rect) {
        const world = clientToWorld(event.clientX, event.clientY, rect, viewport);
        const next = current.type === 'draw' ? { ...current, x1: world.x, y1: world.y } : { ...current, x: world.x, y: world.y };
        interactionRef.current = next;
        setInteraction(next);
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
      if (!rect || current.type !== 'marquee') return;
      const world = clientToWorld(event.clientX, event.clientY, rect, viewport);
      const moved = current.moved || Math.hypot(world.x - current.x0, world.y - current.y0) > 3;
      const box: Rect = {
        x: Math.min(current.x0, world.x),
        y: Math.min(current.y0, world.y),
        w: Math.abs(world.x - current.x0),
        h: Math.abs(world.y - current.y0),
      };
      const hits = editor.project.blocks
        .filter((block) => intersects(box, blockRectOf(editor.project, block)))
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
  const place = placeFor(drag);
  const endDrag = interaction?.type === 'end' ? interaction : null;

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

  const beginDraw = (event: ReactPointerEvent) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = clientToWorld(event.clientX, event.clientY, rect, viewportRef.current);
    const editor = apiRef.current;
    setColorBlockId(null);
    setInteractionBoth({
      type: 'draw',
      pointerId: event.pointerId,
      mode: editor.tool === 'connector' ? 'connector' : 'arrow',
      relation: editor.relation,
      connector: editor.connectorKind,
      x0: world.x,
      y0: world.y,
      x1: world.x,
      y1: world.y,
    });
  };

  const beginEnd = (event: ReactPointerEvent, item: 'arrow' | 'connector', id: string, which: 'from' | 'to') => {
    event.stopPropagation();
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = clientToWorld(event.clientX, event.clientY, rect, viewportRef.current);
    setInteractionBoth({ type: 'end', pointerId: event.pointerId, item, id, which, x: world.x, y: world.y });
  };

  const beginOnElement = (event: ReactPointerEvent, id: string, kind: 'block' | 'group') => {
    if (event.button === 1 || spaceRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, button, textarea')) return;
    event.stopPropagation();
    const editor = apiRef.current;
    if (editor.tool === 'arrow' || editor.tool === 'connector') {
      beginDraw(event);
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
      blockId: kind === 'block' ? id : null,
      shift: event.shiftKey,
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
    if (editor.tool === 'arrow' || editor.tool === 'connector') {
      beginDraw(event);
      return;
    }

    const hit = hitDecoration(editor.project, world.x, world.y, place);
    if (hit) {
      editor.setSelection(
        event.shiftKey && editor.selection.includes(hit)
          ? editor.selection.filter((id) => id !== hit)
          : event.shiftKey
            ? [...editor.selection, hit]
            : [hit],
      );
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
  const drawing = interaction?.type === 'draw' ? interaction : null;
  const targets = snapTargets(api.project, place);
  const magnet =
    drawing
      ? findMagnet({ x: drawing.x1, y: drawing.y1 }, targets, MAGNET_DISTANCE) ??
        findMagnet({ x: drawing.x0, y: drawing.y0 }, targets, MAGNET_DISTANCE)
      : endDrag
        ? findMagnet({ x: endDrag.x, y: endDrag.y }, targets, MAGNET_DISTANCE)
        : null;
  const uncertain = api.project.blocks.some((block) => block.uncertain);
  const hint =
    api.selection.length > 0
      ? ''
      : api.tool === 'arrow'
        ? `Dra for å tegne ${api.relation ?? 'fri tekst'}. Slipp nær et ord for å feste.`
        : api.tool === 'connector'
          ? 'Dra for å sette symbolet. Det fester seg nær et ord, en frase eller en gruppe.'
          : uncertain
            ? 'Stiplede tall er usikre. Klikk × for å fjerne dem.'
            : api.project.blocks.length > 0
              ? 'Tast 1–8 velger relasjon. Mellomrom og dra flytter lerretet.'
              : '';

  return (
    <div
      ref={rootRef}
      className={['canvas', space ? 'space' : '', interaction?.type === 'pan' ? 'panning' : '', api.tool !== 'select' ? 'drawing' : '']
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
        style={{ transform: `translate(${api.viewport.x}px, ${api.viewport.y}px) scale(${api.viewport.zoom})` }}
      >
        {api.project.groups.map((group) => {
          const rect = groupRectOf(api.project, group.id, place);
          if (!rect) return null;
          const selected = api.selection.includes(group.id);
          return (
            <div
              key={group.id}
              className={['group', selected ? 'selected' : '', magnet?.id === group.id ? 'magnet' : ''].filter(Boolean).join(' ')}
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, background: group.fill ?? undefined }}
              onPointerDown={(event) => beginOnElement(event, group.id, 'group')}
            />
          );
        })}
        {api.project.markers
          .filter((marker) => marker.kind === 'hovedpåstand')
          .flatMap((marker) =>
            marker.targetIds.map((targetId) => {
              if (!api.project.groups.some((group) => group.id === targetId)) return null;
              const rect = groupRectOf(api.project, targetId, place);
              if (!rect) return null;
              return <div key={`${marker.id}-${targetId}`} className="claim-line" style={{ left: rect.x + 12, top: rect.y + rect.h - 7, width: Math.max(12, rect.w - 24) }} />;
            }),
          )}
        {api.project.markers
          .filter((marker) => marker.kind === 'innskutt')
          .map((marker) => {
            const rect = markerBounds(api.project, marker.targetIds, place);
            if (!rect) return null;
            return (
              <div
                key={marker.id}
                className={api.selection.includes(marker.id) ? 'innskutt selected' : 'innskutt'}
                style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              />
            );
          })}
        {api.project.frames.map((frame) => {
          const rect = targetRect(api.project, frame.targetId, place);
          const color = api.project.frameColors.find((entry) => entry.id === frame.colorId)?.color;
          if (!rect || !color) return null;
          const pad = 4;
          return (
            <div
              key={frame.id}
              className="analysis-frame"
              style={{
                left: rect.x - pad,
                top: rect.y - pad,
                width: rect.w + pad * 2,
                height: rect.h + pad * 2,
                border: `${frame.thickness}px ${frame.style} ${color}`,
              }}
            />
          );
        })}
        <svg className="arrow-layer">
          {api.project.arrows.map((arrow) => {
            const ends = withDraggedEnd(arrow.from, arrow.to, endDrag?.item === 'arrow' ? endDrag : null, arrow.id);
            const { a, b } = linkPoints(api.project, ends.from, ends.to, place);
            if (Math.hypot(b.x - a.x, b.y - a.y) < 1) return null;
            const selected = api.selection.includes(arrow.id);
            const color = selected ? '#234233' : (arrow.color ?? ARROW_OUTLINE);
            return (
              <path
                key={arrow.id}
                d={polygonPath(blockArrowPolygon(a.x, a.y, b.x, b.y))}
                fill="transparent"
                stroke={color}
                strokeWidth={selected ? 2.6 : 1.7}
                strokeLinejoin="round"
                pointerEvents="auto"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (api.tool !== 'select') {
                    beginDraw(event);
                    return;
                  }
                  api.setSelection([arrow.id]);
                }}
              />
            );
          })}
          {api.project.connectors.map((connector) => {
            const ends = withDraggedEnd(connector.from, connector.to, endDrag?.item === 'connector' ? endDrag : null, connector.id);
            const { a, b } = linkPoints(api.project, ends.from, ends.to, place);
            const selected = api.selection.includes(connector.id);
            return (
              <line
                key={connector.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={selected ? '#234233' : '#5c564c'}
                strokeWidth={selected ? 2.2 : 1.4}
                pointerEvents="stroke"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (api.tool !== 'select') {
                    beginDraw(event);
                    return;
                  }
                  api.setSelection([connector.id]);
                }}
              />
            );
          })}
          {drawing && drawing.mode === 'arrow' && Math.hypot(drawing.x1 - drawing.x0, drawing.y1 - drawing.y0) > 2 && (
            <path
              d={polygonPath(blockArrowPolygon(drawing.x0, drawing.y0, drawing.x1, drawing.y1))}
              fill="none"
              stroke={ARROW_OUTLINE}
              strokeWidth={1.7}
              strokeLinejoin="round"
              opacity={0.85}
            />
          )}
          {drawing && drawing.mode === 'connector' && (
            <line x1={drawing.x0} y1={drawing.y0} x2={drawing.x1} y2={drawing.y1} stroke="#5c564c" strokeWidth={1.4} />
          )}
        </svg>
        {api.project.blocks.map((block) => (
          <BlockView
            key={block.id}
            project={api.project}
            block={block}
            place={place}
            selected={api.selection.includes(block.id)}
            magnet={magnet?.id === block.id}
            editing={api.editingId === block.id}
            draftText={draftText}
            onDraft={setDraftText}
            onPointerDown={(event) => beginOnElement(event, block.id, 'block')}
            onEdit={() => {
              if (api.tool !== 'select') return;
              cancelEdit.current = false;
              setColorBlockId(null);
              setDraftText(block.text);
              api.setEditingId(block.id);
            }}
            onCommit={(text) => {
              cancelEdit.current = true;
              api.setBlockText(block.id, text);
              api.setEditingId(null);
            }}
            onCancel={() => {
              cancelEdit.current = true;
              api.setEditingId(null);
            }}
            onBlur={() => {
              if (cancelEdit.current) {
                cancelEdit.current = false;
                return;
              }
              api.setBlockText(block.id, draftText);
              api.setEditingId(null);
            }}
            onDelete={() => api.deleteIds([block.id])}
          />
        ))}
        {api.project.arrows.map((arrow) => {
          const ends = withDraggedEnd(arrow.from, arrow.to, endDrag?.item === 'arrow' ? endDrag : null, arrow.id);
          const { a, b } = linkPoints(api.project, ends.from, ends.to, place);
          const length = Math.hypot(b.x - a.x, b.y - a.y);
          const caption = relationCaption(arrow.relation, arrow.label);
          if (!caption || length < 1) return null;
          const pose = labelPose(a.x, a.y, b.x, b.y, labelGap(length));
          const selected = api.selection.includes(arrow.id);
          return (
            <div
              key={`${arrow.id}-label`}
              className={selected ? 'relation-label selected' : 'relation-label'}
              style={{ left: pose.x, top: pose.y, transform: `translate(-50%, -50%) rotate(${pose.deg}deg)` }}
              onPointerDown={(event) => {
                event.stopPropagation();
                api.setSelection([arrow.id]);
              }}
            >
              {caption}
            </div>
          );
        })}
        {drawing?.mode === 'arrow' && drawing.relation && Math.hypot(drawing.x1 - drawing.x0, drawing.y1 - drawing.y0) > 8 && (
          <DrawLabel x0={drawing.x0} y0={drawing.y0} x1={drawing.x1} y1={drawing.y1} text={drawing.relation} />
        )}
        {api.project.connectors.map((connector) => {
          const ends = withDraggedEnd(connector.from, connector.to, endDrag?.item === 'connector' ? endDrag : null, connector.id);
          const { a, b } = linkPoints(api.project, ends.from, ends.to, place);
          const glyph = CONNECTORS.find((item) => item.id === connector.kind)?.glyph ?? '';
          return (
            <div
              key={`${connector.id}-glyph`}
              className={api.selection.includes(connector.id) ? 'connector-glyph selected' : 'connector-glyph'}
              style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2 }}
              onPointerDown={(event) => {
                event.stopPropagation();
                api.setSelection([connector.id]);
              }}
            >
              {glyph}
            </div>
          );
        })}
        {api.project.showComments &&
          api.project.comments.map((comment) => (
            <CommentNote key={comment.id} comment={comment} origin={commentOrigin(api.project, comment, place)} />
          ))}
        {api.selection.map((id) => {
          const arrow = api.project.arrows.find((item) => item.id === id);
          const connector = api.project.connectors.find((item) => item.id === id);
          const link = arrow ?? connector;
          if (!link || api.tool !== 'select') return null;
          const ends = withDraggedEnd(link.from, link.to, endDrag, id);
          const { a, b } = linkPoints(api.project, ends.from, ends.to, place);
          const item = arrow ? 'arrow' : 'connector';
          return (
            <span key={`${id}-handles`}>
              <button type="button" className="handle" style={{ left: a.x, top: a.y }} aria-label="Dra start" onPointerDown={(event) => beginEnd(event, item, id, 'from')} />
              <button type="button" className="handle" style={{ left: b.x, top: b.y }} aria-label="Dra slutt" onPointerDown={(event) => beginEnd(event, item, id, 'to')} />
            </span>
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
      {colorBlockId && api.tool === 'select' && <WordColor blockId={colorBlockId} onClose={() => setColorBlockId(null)} />}
      {api.project.blocks.length === 0 && (
        <div className="empty">
          <h1>Lim inn en bibeltekst for å begynne</h1>
          <p>Ingen fast metode. Flytt, grupper og bind sammen ordene slik du vil.</p>
          <button type="button" className="btn primary" onPointerDown={(event) => event.stopPropagation()} onClick={() => api.setImportOpen(true)}>
            Importer tekst
          </button>
        </div>
      )}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function DrawLabel({ x0, y0, x1, y1, text }: { x0: number; y0: number; x1: number; y1: number; text: string }) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const pose = labelPose(x0, y0, x1, y1, labelGap(length));
  return (
    <div className="relation-label" style={{ left: pose.x, top: pose.y, transform: `translate(-50%, -50%) rotate(${pose.deg}deg)` }}>
      {text}
    </div>
  );
}

function BlockView({
  project,
  block,
  place,
  selected,
  magnet,
  editing,
  draftText,
  onDraft,
  onPointerDown,
  onEdit,
  onCommit,
  onCancel,
  onBlur,
  onDelete,
}: {
  project: Project;
  block: Block;
  place?: PlaceFn;
  selected: boolean;
  magnet: boolean;
  editing: boolean;
  draftText: string;
  onDraft: (text: string) => void;
  onPointerDown: (event: ReactPointerEvent) => void;
  onEdit: () => void;
  onCommit: (text: string) => void;
  onCancel: () => void;
  onBlur: () => void;
  onDelete: () => void;
}) {
  const font = projectFont(project, block);
  const rect = blockRectOf(project, editing ? { ...block, text: draftText || block.text } : block, place);
  const role = LOGIC_ROLES.find((item) => item.id === block.role);
  const claim = project.markers.some((marker) => marker.kind === 'hovedpåstand' && marker.targetIds.includes(block.id));
  const height = Math.max(rect.h, editing ? blockHeight(font.size) : BLOCK_H);
  return (
    <div
      data-id={block.id}
      className={['block', selected ? 'selected' : '', block.kind === 'number' ? 'number' : '', block.uncertain ? 'uncertain' : '', magnet ? 'magnet' : '', editing ? 'editing' : '', claim ? 'claim' : '']
        .filter(Boolean)
        .join(' ')}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height,
        background: block.fill ?? undefined,
        color: block.textColor ?? undefined,
        fontFamily: fontFamilyCss(font.family),
        fontSize: font.size,
        fontWeight: font.weight,
      }}
      title={block.uncertain ? 'Usikkert tall' : undefined}
      onPointerDown={onPointerDown}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEdit();
      }}
    >
      {project.showRoleIcons && role && !block.roleHidden && (
        <span className="role-icon" title={role.label}>
          {role.glyph}
        </span>
      )}
      {editing ? (
        <input
          className="block-edit"
          value={draftText}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onDraft(event.target.value)}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              onCommit(draftText);
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
          onBlur={onBlur}
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
            onDelete();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function CommentNote({ comment, origin }: { comment: Comment; origin: { x: number; y: number } }) {
  const api = useEditor();
  const [text, setText] = useState(comment.text);
  useEffect(() => setText(comment.text), [comment.id, comment.text]);
  if (comment.minimized) {
    return (
      <button
        type="button"
        className="comment-mark"
        style={{ left: origin.x, top: origin.y }}
        title="Vis kommentar"
        aria-label="Vis kommentar"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => api.updateComment(comment.id, { minimized: false })}
      />
    );
  }
  return (
    <div className="comment-note" style={{ left: origin.x, top: origin.y }} onPointerDown={(event) => event.stopPropagation()}>
      <textarea
        aria-label="Kommentar"
        value={text}
        placeholder="Kommentar"
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          if (text !== comment.text) api.updateComment(comment.id, { text });
        }}
      />
      <button type="button" className="btn tiny" onClick={() => api.updateComment(comment.id, { minimized: true })}>
        Minimer
      </button>
    </div>
  );
}

function WordColor({ blockId, onClose }: { blockId: string; onClose: () => void }) {
  const { viewport } = useEditor();
  const node = document.querySelector(`[data-id="${CSS.escape(blockId)}"]`);
  const anchor = node instanceof HTMLElement ? node : null;
  if (!anchor) return null;
  return (
    <ColorPopover
      onClose={onClose}
      anchorElement={anchor}
      prefer="around"
      word
      watch={`${viewport.x}:${viewport.y}:${viewport.zoom}`}
    />
  );
}

function hitDecoration(project: Project, x: number, y: number, place?: PlaceFn): string | null {
  for (const arrow of project.arrows) {
    const { a, b } = linkPoints(project, arrow.from, arrow.to, place);
    if (hitsBlockArrow(x, y, a.x, a.y, b.x, b.y)) return arrow.id;
  }
  for (const connector of project.connectors) {
    const { a, b } = linkPoints(project, connector.from, connector.to, place);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    if (distanceToSegment(x, y, a.x, a.y, b.x, b.y) < 12 || Math.hypot(x - midX, y - midY) < 16) return connector.id;
  }
  for (const marker of project.markers) {
    if (marker.kind !== 'innskutt') continue;
    const rect = markerBounds(project, marker.targetIds, place);
    if (rect && nearStroke(x, y, rect)) return marker.id;
  }
  return null;
}

function nearStroke(x: number, y: number, rect: Rect): boolean {
  const pad = 8;
  const outer = x >= rect.x - pad && x <= rect.x + rect.w + pad && y >= rect.y - pad && y <= rect.y + rect.h + pad;
  const inner = x >= rect.x + pad && x <= rect.x + rect.w - pad && y >= rect.y + pad && y <= rect.y + rect.h - pad;
  return outer && !inner;
}
