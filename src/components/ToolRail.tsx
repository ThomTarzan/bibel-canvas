import { CONNECTORS, RELATIONS } from '../lib/catalog';
import { useEditor } from '../state/EditorContext';

export function ToolRail() {
  const api = useEditor();
  return (
    <aside className="tool-rail" aria-label="Verktøy">
      <h2>Relasjon</h2>
      <div className="rail-list">
        {RELATIONS.map((relation, index) => {
          const active = api.tool === 'arrow' && api.relation === relation.id;
          return (
            <button
              key={relation.id}
              type="button"
              className={active ? 'rail-btn active' : 'rail-btn'}
              aria-pressed={active}
              title={relation.help ?? `Tast ${index + 1}`}
              onClick={() => api.armRelation(relation.id)}
            >
              <span className="rail-key">{index + 1}</span>
              {relation.label}
            </button>
          );
        })}
        <button
          type="button"
          className={api.tool === 'arrow' && api.relation === null ? 'rail-btn active' : 'rail-btn'}
          aria-pressed={api.tool === 'arrow' && api.relation === null}
          onClick={() => api.armRelation(null)}
        >
          <span className="rail-key">T</span>
          Fri tekst
        </button>
      </div>
      <h2>Symbol</h2>
      <div className="rail-list">
        {CONNECTORS.map((connector) => {
          const active = api.tool === 'connector' && api.connectorKind === connector.id;
          return (
            <button
              key={connector.id}
              type="button"
              className={active ? 'rail-btn active' : 'rail-btn'}
              aria-pressed={active}
              onClick={() => api.armConnector(connector.id)}
            >
              <span className="rail-key">{connector.glyph}</span>
              {connector.label}
            </button>
          );
        })}
        <button type="button" className="rail-btn" onClick={api.addInnskutt} title="Stiplet ramme rundt utvalget">
          <span className="rail-key">▭</span>
          Innskutt
        </button>
        <button type="button" className="rail-btn" onClick={api.toggleHovedpastand} title="Tykkere markering på ord eller gruppe">
          <span className="rail-key">—</span>
          Hovedpåstand
        </button>
      </div>
    </aside>
  );
}
