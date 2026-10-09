import { useEffect, useState } from 'react';
import { RELATIONS } from '../lib/catalog';
import { useEditor } from '../state/EditorContext';

export function Legends() {
  const api = useEditor();
  return (
    <>
      {api.project.showRelationLegend && (
        <aside className="legend legend-relations" aria-label="Forklaring">
          <header>
            <span>Forklaring</span>
            <button type="button" className="btn tiny" onClick={api.toggleRelationLegend}>
              Skjul
            </button>
          </header>
          <ol>
            {RELATIONS.map((relation, index) => (
              <li key={relation.id} title={relation.help}>
                <span>{index + 1}</span>
                {relation.label}
                {relation.help ? <small>{relation.help}</small> : null}
              </li>
            ))}
          </ol>
        </aside>
      )}
      {api.project.showFrameLegend && <FrameLegend />}
    </>
  );
}

function FrameLegend() {
  const api = useEditor();
  return (
    <aside className="legend legend-frames" aria-label="Rammer">
      <header>
        <span>Rammer</span>
        <button type="button" className="btn tiny" onClick={api.toggleFrameLegend}>
          Skjul
        </button>
      </header>
      {api.project.frameColors.length === 0 && <p className="legend-empty">Ingen farger ennå.</p>}
      <ul>
        {api.project.frameColors.map((entry) => (
          <FrameRow key={entry.id} id={entry.id} color={entry.color} name={entry.name} />
        ))}
      </ul>
      <button type="button" className="btn tiny" onClick={api.addFrameColor}>
        Ny farge
      </button>
    </aside>
  );
}

function FrameRow({ id, color, name }: { id: string; color: string; name: string }) {
  const api = useEditor();
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  return (
    <li>
      <label className="legend-color">
        <input
          type="color"
          aria-label="Rammefarge"
          value={toColorInput(color)}
          onChange={(event) => api.updateFrameColor(id, { color: event.target.value })}
        />
      </label>
      <input
        aria-label="Navn på rammefarge"
        value={draft}
        placeholder="Navn"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== name) api.updateFrameColor(id, { name: draft });
        }}
      />
      <button type="button" className="btn tiny" aria-label="Slett farge" onClick={() => api.deleteFrameColor(id)}>
        ×
      </button>
    </li>
  );
}

function toColorInput(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#e10600';
}
