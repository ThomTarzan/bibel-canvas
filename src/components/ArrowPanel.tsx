import { useEffect, useState } from 'react';
import { ARROW_COLORS } from '../lib/colors';
import { RELATIONS } from '../types';
import { useEditor } from '../state/EditorContext';
import type { ArrowStyle } from '../types';

const STYLES: { id: ArrowStyle; label: string }[] = [
  { id: 'straight', label: 'Rett' },
  { id: 'curved', label: 'Buet' },
  { id: 'dashed', label: 'Stiplet' },
];

export function ArrowPanel() {
  const { project, selection, updateArrow } = useEditor();
  const arrows = project.arrows.filter((arrow) => selection.includes(arrow.id));
  if (arrows.length !== 1) return null;
  const arrow = arrows[0];
  const [label, setLabel] = useState(arrow.label);

  useEffect(() => setLabel(arrow.label), [arrow.id, arrow.label]);

  return (
    <section className="arrow-panel" aria-label="Pil">
      <header>Pil</header>
      <div className="chips">
        {RELATIONS.map((relation) => (
          <button
            key={relation.id}
            type="button"
            className={arrow.label === relation.label ? 'chip active' : 'chip'}
            onClick={() => updateArrow(arrow.id, { label: arrow.label === relation.label ? '' : relation.label })}
          >
            {relation.label}
          </button>
        ))}
      </div>
      <label className="field compact">
        <span>Egen tekst</span>
        <input
          value={label}
          placeholder="Etikett"
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => {
            if (label !== arrow.label) updateArrow(arrow.id, { label });
          }}
        />
      </label>
      <div className="segment">
        {STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            className={arrow.style === style.id ? 'btn tiny active' : 'btn tiny'}
            onClick={() => updateArrow(arrow.id, { style: style.id })}
          >
            {style.label}
          </button>
        ))}
      </div>
      <div className="swatches tight">
        <button
          type="button"
          className={arrow.color === null ? 'swatch standard selected' : 'swatch standard'}
          onClick={() => updateArrow(arrow.id, { color: null })}
          aria-label="Standard pilfarge"
        />
        {ARROW_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={arrow.color === color ? 'swatch selected' : 'swatch'}
            style={{ background: color }}
            onClick={() => updateArrow(arrow.id, { color })}
            aria-label={color}
          />
        ))}
        <label className="free-color inline">
          <input
            type="color"
            aria-label="Egen pilfarge"
            defaultValue={arrow.color ?? '#5c675f'}
            key={arrow.color ?? 'standard'}
            onBlur={(event) => {
              if (event.target.value !== (arrow.color ?? '#5c675f')) updateArrow(arrow.id, { color: event.target.value });
            }}
          />
        </label>
      </div>
    </section>
  );
}
