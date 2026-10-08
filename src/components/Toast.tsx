import { useEditor } from '../state/EditorContext';

export function Toast({ lifted }: { lifted: boolean }) {
  const { toast, undo, dismissToast } = useEditor();
  if (!toast) return null;

  return (
    <div className={lifted ? 'toast lifted' : 'toast'} role="status">
      <span>{toast.message}</span>
      {toast.offerUndo && (
        <button type="button" className="btn tiny" onClick={undo}>
          Angre
        </button>
      )}
      <button type="button" className="btn tiny ghost" onClick={dismissToast} aria-label="Lukk varsel">
        Lukk
      </button>
    </div>
  );
}
