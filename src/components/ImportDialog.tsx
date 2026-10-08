import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useEditor } from '../state/EditorContext';

export function ImportDialog() {
  const { importOpen, setImportOpen, importText, project } = useEditor();
  const [reference, setReference] = useState(project.reference);
  const [text, setText] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!importOpen) return;
    setReference(project.reference);
    setText('');
    const frame = window.requestAnimationFrame(() => areaRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [importOpen, project.reference]);

  if (!importOpen) return null;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!text.trim()) return;
    importText(text, reference);
  };

  return (
    <div className="modal-back" onMouseDown={() => setImportOpen(false)}>
      <form className="modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>Importer tekst</h2>
        <p className="modal-lead">
          Hvert ord blir en brikke i leserekkefølge. Linjeskift starter en ny rad. Tegnsetting følger ordet.
        </p>
        <label className="field">
          <span>Referanse (valgfritt)</span>
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Rom 8,1–4"
          />
        </label>
        <label className="field">
          <span>Tekst</span>
          <textarea
            ref={areaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Lim inn bibeltekst …"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
              if (event.key === 'Escape') setImportOpen(false);
            }}
          />
        </label>
        {project.blocks.length > 0 && (
          <p className="modal-note">Dette erstatter det som ligger på lerretet. Du kan angre.</p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => setImportOpen(false)}>
            Avbryt
          </button>
          <button type="submit" className="btn primary" disabled={!text.trim()}>
            Legg på lerretet
          </button>
        </div>
      </form>
    </div>
  );
}
