import { useEffect, useRef, useState } from 'react';
import { readJsonFile } from '../lib/files';
import { projectFilename } from '../lib/filename';
import { parseProject } from '../lib/project';
import { useEditor } from '../state/EditorContext';
import { IconMinus, IconPlus, IconRedo, IconUndo } from './icons';
import { ExportMenu, GlobalFontMenu, SettingsMenu, ViewMenu } from './menus';

export function TopBar() {
  const api = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [reference, setReference] = useState(api.project.reference);
  const [menu, setMenu] = useState<'font' | 'view' | 'settings' | 'export' | null>(null);
  const hasNumbers = api.project.blocks.some((block) => block.kind === 'number');

  useEffect(() => setReference(api.project.reference), [api.project.reference]);

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseProject(await readJsonFile(file));
      if (!parsed) {
        api.notify('Kunne ikke åpne filen. Den er ikke et gjenkjennelig prosjekt.');
        return;
      }
      api.loadProject(parsed);
    } catch {
      api.notify('Kunne ikke åpne filen. Den er ikke et gjenkjennelig prosjekt.');
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="mark" aria-hidden="true" />
        <span>Bibel-canvas</span>
      </div>
      <input
        className="reference"
        aria-label="Referanse"
        placeholder="Referanse"
        value={reference}
        onChange={(event) => setReference(event.target.value)}
        onBlur={() => api.setReference(reference.trim())}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      <div className="cluster">
        <button type="button" className="btn icon-btn" onClick={api.undo} disabled={!api.canUndo} aria-label="Angre" title="Angre (Ctrl+Z)">
          <IconUndo />
        </button>
        <button type="button" className="btn icon-btn" onClick={api.redo} disabled={!api.canRedo} aria-label="Gjør om" title="Gjør om (Ctrl+Shift+Z)">
          <IconRedo />
        </button>
        <span className="divider" />
        <button
          type="button"
          className={api.project.grid ? 'btn active' : 'btn'}
          aria-pressed={api.project.grid}
          onClick={api.toggleGrid}
        >
          Rutenett
        </button>
        <button
          type="button"
          className={api.project.snap ? 'btn active' : 'btn'}
          aria-pressed={api.project.snap}
          onClick={api.toggleSnap}
          title="Fest til rutenett"
        >
          Fest
        </button>
        <span className="divider" />
        <button type="button" className="btn icon-btn" onClick={() => api.zoomBy(1 / 1.15)} aria-label="Zoom ut">
          <IconMinus />
        </button>
        <button type="button" className="btn zoom-readout" onClick={api.resetZoom} title="Tilbakestill zoom">
          {Math.round(api.viewport.zoom * 100)} %
        </button>
        <button type="button" className="btn icon-btn" onClick={() => api.zoomBy(1.15)} aria-label="Zoom inn">
          <IconPlus />
        </button>
        <span className="divider" />
        <div className="color-anchor" ref={fontRef}>
          <button type="button" className={menu === 'font' ? 'btn active' : 'btn'} onClick={() => setMenu(menu === 'font' ? null : 'font')}>
            Skrift
          </button>
          {menu === 'font' && <GlobalFontMenu anchorRef={fontRef} onClose={() => setMenu(null)} />}
        </div>
        <div className="color-anchor" ref={viewRef}>
          <button type="button" className={menu === 'view' ? 'btn active' : 'btn'} onClick={() => setMenu(menu === 'view' ? null : 'view')}>
            Vis
          </button>
          {menu === 'view' && <ViewMenu anchorRef={viewRef} onClose={() => setMenu(null)} />}
        </div>
        <div className="color-anchor" ref={settingsRef}>
          <button
            type="button"
            className={menu === 'settings' ? 'btn active' : 'btn'}
            onClick={() => setMenu(menu === 'settings' ? null : 'settings')}
          >
            Innstillinger
          </button>
          {menu === 'settings' && <SettingsMenu anchorRef={settingsRef} onClose={() => setMenu(null)} />}
        </div>
        <div className="color-anchor" ref={exportRef}>
          <button type="button" className={menu === 'export' ? 'btn active' : 'btn'} onClick={() => setMenu(menu === 'export' ? null : 'export')}>
            Eksporter
          </button>
          {menu === 'export' && <ExportMenu anchorRef={exportRef} onClose={() => setMenu(null)} />}
        </div>
        <button type="button" className="btn" disabled={!hasNumbers} onClick={api.deleteAllNumbers}>
          Slett alle tall
        </button>
        <button type="button" className="btn primary" onClick={() => api.setImportOpen(true)}>
          Importer tekst
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Åpne
        </button>
        <button
          type="button"
          className="btn"
          onClick={api.saveProject}
          title={projectFilename(api.project.reference, new Date())}
        >
          Lagre
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            void openFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
    </header>
  );
}
