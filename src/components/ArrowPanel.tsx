import { useEffect, useState } from 'react';
import { RELATIONS, relationCaption } from '../lib/catalog';
import { ARROW_OUTLINE, ARROW_OUTLINE_CHOICES } from '../lib/colors';
import { useEditor } from '../state/EditorContext';

export function ArrowPanel() {
  const { project, selection, updateArrow } = useEditor();
  const arrows = project.arrows.filter((arrow) => selection.includes(arrow.id));
  const arrow = arrows.length === 1 ? arrows[0] : null;
  const [label, setLabel] = useState(arrow?.label ?? '');

  useEffect(() => setLabel(arrow?.label ?? ''), [arrow?.id, arrow?.label]);
  if (!arrow) return null;

  const caption = relationCaption(arrow.relation, arrow.label);

  return (
    <section className="arrow-panel" aria-label="Pil">
      <header>Pil{caption ? ` · ${caption}` : ''}</header>
      <div className="chips">
        {RELATIONS.map((relation) => (
          <button
            key={relation.id}
            type="button"
            className={arrow.relation === relation.id ? 'chip active' : 'chip'}
            title={relation.help}
            onClick={() => updateArrow(arrow.id, { relation: arrow.relation === relation.id ? null : relation.id })}
          >
            {relation.label}
          </button>
        ))}
      </div>
      <label className="field compact">
        <span>Fri tekst</span>
        <input
          value={label}
          placeholder="Etikett"
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => {
            if (label !== arrow.label) updateArrow(arrow.id, { label, relation: null });
          }}
        />
      </label>
      <div className="swatches tight">
        <span className="menu-label">Omriss</span>
        {ARROW_OUTLINE_CHOICES.map((color) => {
          const isStandard = color === ARROW_OUTLINE && arrow.color === null;
          const on = arrow.color === color || isStandard;
          return (
            <button
              key={color}
              type="button"
              className={on ? 'swatch selected' : 'swatch'}
              style={{ background: color }}
              aria-label={color === ARROW_OUTLINE ? 'Standard omriss' : color}
              onClick={() => updateArrow(arrow.id, { color: color === ARROW_OUTLINE ? null : color })}
            />
          );
        })}
      </div>
      <p className="panel-note">Dra i endene for å flytte pilen. Den fester seg nær et ord.</p>
    </section>
  );
}