import { useEffect, useRef, useState } from 'react';
import { ARROW_COLORS, FILL_COLORS, INK_COLORS } from '../lib/colors';
import { useEditor } from '../state/EditorContext';

type Target = 'fill' | 'text' | 'group' | 'arrow';

const TARGETS: { id: Target; label: string }[] = [
  { id: 'fill', label: 'Fyll' },
  { id: 'text', label: 'Tekst' },
  { id: 'group', label: 'Gruppe' },
  { id: 'arrow', label: 'Pil' },
];

export function ColorPopover({ onClose }: { onClose: () => void }) {
  const { project, selection, setFill, setTextColor, setGroupFill, setArrowColor } = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  const blockIds = selection.filter((id) => project.blocks.some((block) => block.id === id));
  const blocks = project.blocks.filter((block) => blockIds.includes(block.id));
  const groupIds = new Set(selection.filter((id) => project.groups.some((group) => group.id === id)));
  for (const block of blocks) if (block.groupId) groupIds.add(block.groupId);
  const groups = project.groups.filter((group) => groupIds.has(group.id));
  const arrows = project.arrows.filter((arrow) => selection.includes(arrow.id));

  const available = TARGETS.filter((target) => {
    if (target.id === 'fill' || target.id === 'text') return blocks.length > 0;
    if (target.id === 'group') return groups.length > 0;
    return arrows.length > 0;
  });
  const [target, setTarget] = useState<Target>(available[0]?.id ?? 'fill');
  const active = available.some((item) => item.id === target) ? target : available[0]?.id;

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [onClose]);

  if (!active) return null;

  const palette = active === 'text' ? INK_COLORS : active === 'arrow' ? ARROW_COLORS : FILL_COLORS;
  const currentValues =
    active === 'text'
      ? blocks.map((block) => block.textColor)
      : active === 'arrow'
        ? arrows.map((arrow) => arrow.color)
        : active === 'group'
          ? groups.map((group) => group.fill)
          : blocks.map((block) => block.fill);
  const uniform = currentValues.every((value) => value === currentValues[0]) ? currentValues[0] : undefined;

  const apply = (color: string | null) => {
    if (active === 'fill') setFill(color);
    else if (active === 'text') setTextColor(color);
    else if (active === 'group') setGroupFill(color);
    else setArrowColor(color);
  };

  return (
    <div className="popover" ref={ref} onPointerDown={(event) => event.stopPropagation()}>
      <div className="segment">
        {available.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === active ? 'btn tiny active' : 'btn tiny'}
            onClick={() => setTarget(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="swatches">
        <button
          type="button"
          className={uniform === null ? 'swatch standard selected' : 'swatch standard'}
          onClick={() => apply(null)}
          title="Standard"
          aria-label="Standardfarge"
        />
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            className={uniform === color ? 'swatch selected' : 'swatch'}
            style={{ background: color }}
            onClick={() => apply(color)}
            aria-label={color}
          />
        ))}
      </div>
      <label className="free-color">
        Egen farge
        <input
          type="color"
          defaultValue={typeof uniform === 'string' ? uniform : '#3f4f42'}
          key={typeof uniform === 'string' ? uniform : 'standard'}
          onBlur={(event) => apply(event.target.value)}
        />
      </label>
    </div>
  );
}
