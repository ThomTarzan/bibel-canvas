import { useState, type RefObject } from 'react';
import { ARROW_OUTLINE, ARROW_OUTLINE_CHOICES, FILL_COLORS, INK_COLORS } from '../lib/colors';
import type { PopoverPrefer } from '../lib/placePopover';
import { useEditor } from '../state/EditorContext';
import { Popover } from './Popover';

type Target = 'fill' | 'text' | 'group' | 'arrow';

const TARGETS: { id: Target; label: string }[] = [
  { id: 'fill', label: 'Fyll' },
  { id: 'text', label: 'Tekst' },
  { id: 'group', label: 'Gruppe' },
  { id: 'arrow', label: 'Pil' },
];

export function ColorPopover({
  onClose,
  anchorRef,
  anchorElement = null,
  prefer = 'below',
  word = false,
  watch,
}: {
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
  anchorElement?: HTMLElement | null;
  prefer?: PopoverPrefer;
  word?: boolean;
  watch?: unknown;
}) {
  const { project, selection, setFill, setTextColor, setGroupFill, setArrowColor } = useEditor();
  const blockIds = selection.filter((id) => project.blocks.some((block) => block.id === id));
  const blocks = project.blocks.filter((block) => blockIds.includes(block.id));
  const groupIds = new Set(selection.filter((id) => project.groups.some((group) => group.id === id)));
  for (const block of blocks) if (block.groupId) groupIds.add(block.groupId);
  const groups = project.groups.filter((group) => groupIds.has(group.id));
  const arrows = project.arrows.filter((arrow) => selection.includes(arrow.id));

  const available = TARGETS.filter((target) => {
    if (word && target.id !== 'fill' && target.id !== 'text') return false;
    if (target.id === 'fill' || target.id === 'text') return blocks.length > 0;
    if (target.id === 'group') return groups.length > 0;
    return arrows.length > 0;
  });
  const [target, setTarget] = useState<Target>(available[0]?.id ?? 'fill');
  const active = available.some((item) => item.id === target) ? target : available[0]?.id;

  if (!active) return null;

  const palette = active === 'text' ? INK_COLORS : active === 'arrow' ? ARROW_OUTLINE_CHOICES : FILL_COLORS;
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
    <Popover
      prefer={prefer}
      anchorRef={anchorRef}
      anchorElement={anchorElement}
      onClose={onClose}
      watch={watch}
    >
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
          defaultValue={typeof uniform === 'string' ? uniform : active === 'arrow' ? ARROW_OUTLINE : '#e23d8c'}
          key={typeof uniform === 'string' ? uniform : 'standard'}
          onBlur={(event) => apply(event.target.value)}
        />
      </label>
    </Popover>
  );
}
