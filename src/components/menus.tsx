import { useState, type RefObject } from 'react';
import { LOGIC_ROLES } from '../lib/catalog';
import { buildExportSvg } from '../lib/exportSvg';
import { downloadSvgAsPng, downloadText } from '../lib/files';
import { projectFilename } from '../lib/filename';
import { useEditor } from '../state/EditorContext';
import type { FontFamilyId, FrameStyle } from '../types';
import { LineBreakOptions } from './LineBreakOptions';
import { Popover } from './Popover';

export function GlobalFontMenu({
  onClose,
  anchorRef,
}: {
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const api = useEditor();
  const font = api.project.typography;
  return (
    <Popover className="popover-menu" prefer="below" anchorRef={anchorRef} onClose={onClose}>
      <p className="menu-label">Skrift for hele lerretet</p>
      <FamilySizeWeight
        family={font.fontFamily}
        size={font.fontSize}
        weight={font.fontWeight}
        onFamily={(fontFamily) => api.setTypography({ fontFamily })}
        onSize={(fontSize) => api.setTypography({ fontSize })}
        onWeight={(fontWeight) => api.setTypography({ fontWeight })}
      />
    </Popover>
  );
}

export function BlockFontMenu({
  onClose,
  anchorRef,
}: {
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const api = useEditor();
  const blocks = api.project.blocks.filter((block) => api.selection.includes(block.id));
  const first = blocks[0];
  const family = first?.fontFamily ?? api.project.typography.fontFamily;
  const size = first?.fontSize ?? api.project.typography.fontSize;
  const weight = first?.fontWeight ?? api.project.typography.fontWeight;
  return (
    <Popover className="popover-menu" prefer="below" anchorRef={anchorRef} onClose={onClose}>
      <p className="menu-label">Skrift på utvalget</p>
      <FamilySizeWeight
        family={family}
        size={size}
        weight={weight}
        onFamily={(fontFamily) => api.setBlockFont({ fontFamily })}
        onSize={(fontSize) => api.setBlockFont({ fontSize })}
        onWeight={(fontWeight) => api.setBlockFont({ fontWeight })}
      />
      <button type="button" className="btn tiny" onClick={() => api.setBlockFont({ fontFamily: null, fontSize: null, fontWeight: null })}>
        Følg lerretet
      </button>
    </Popover>
  );
}

function FamilySizeWeight({
  family,
  size,
  weight,
  onFamily,
  onSize,
  onWeight,
}: {
  family: FontFamilyId;
  size: number;
  weight: number;
  onFamily: (family: FontFamilyId) => void;
  onSize: (size: number) => void;
  onWeight: (weight: number) => void;
}) {
  return (
    <>
      <div className="segment">
        <button type="button" className={family === 'elegant' ? 'btn tiny active' : 'btn tiny'} onClick={() => onFamily('elegant')}>
          Elegant
        </button>
        <button type="button" className={family === 'neutral' ? 'btn tiny active' : 'btn tiny'} onClick={() => onFamily('neutral')}>
          Nøytral
        </button>
      </div>
      <div className="segment">
        {[14, 17, 20, 24].map((value) => (
          <button key={value} type="button" className={size === value ? 'btn tiny active' : 'btn tiny'} onClick={() => onSize(value)}>
            {value}
          </button>
        ))}
      </div>
      <div className="segment">
        <button type="button" className={weight !== 600 ? 'btn tiny active' : 'btn tiny'} onClick={() => onWeight(400)}>
          Vanlig
        </button>
        <button type="button" className={weight === 600 ? 'btn tiny active' : 'btn tiny'} onClick={() => onWeight(600)}>
          Halvfet
        </button>
      </div>
    </>
  );
}

export function FrameMenu({
  onClose,
  anchorRef,
}: {
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const api = useEditor();
  const [thickness, setThickness] = useState(3);
  const [style, setStyle] = useState<FrameStyle>('solid');
  const existing = api.project.frames.find((frame) => api.selection.includes(frame.targetId));
  const paint = (colorId: string, nextThickness = thickness, nextStyle = style) => api.applyFrame(colorId, nextThickness, nextStyle);
  return (
    <Popover className="popover-menu" prefer="below" anchorRef={anchorRef} onClose={onClose}>
      <p className="menu-label">Ramme</p>
      {api.project.frameColors.length === 0 && <p className="legend-empty">Legg til en farge i rammeforklaringen.</p>}
      <div className="frame-choices">
        {api.project.frameColors.map((entry) => (
          <button key={entry.id} type="button" className="frame-choice" onClick={() => paint(entry.id)}>
            <span style={{ background: entry.color }} />
            {entry.name || 'uten navn'}
          </button>
        ))}
      </div>
      <div className="segment">
        {[
          { value: 2, label: 'Tynn' },
          { value: 3, label: 'Vanlig' },
          { value: 5, label: 'Tykk' },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            className={thickness === item.value ? 'btn tiny active' : 'btn tiny'}
            onClick={() => {
              setThickness(item.value);
              if (existing) paint(existing.colorId, item.value, style);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="segment">
        <button
          type="button"
          className={style === 'solid' ? 'btn tiny active' : 'btn tiny'}
          onClick={() => {
            setStyle('solid');
            if (existing) paint(existing.colorId, thickness, 'solid');
          }}
        >
          Heltrukken
        </button>
        <button
          type="button"
          className={style === 'dashed' ? 'btn tiny active' : 'btn tiny'}
          onClick={() => {
            setStyle('dashed');
            if (existing) paint(existing.colorId, thickness, 'dashed');
          }}
        >
          Stiplet
        </button>
        <button type="button" className="btn tiny" onClick={api.clearFrames}>
          Fjern ramme
        </button>
      </div>
    </Popover>
  );
}

export function RoleMenu({
  onClose,
  anchorRef,
}: {
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const api = useEditor();
  const blocks = api.project.blocks.filter((block) => api.selection.includes(block.id));
  const current = blocks.length === 1 ? blocks[0].role : null;
  return (
    <Popover className="popover-menu" prefer="below" anchorRef={anchorRef} onClose={onClose}>
      <p className="menu-label">Rolleikon</p>
      <div className="rail-list">
        {LOGIC_ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            className={current === role.id ? 'rail-btn active' : 'rail-btn'}
            onClick={() => api.setRole(current === role.id ? null : role.id)}
          >
            <span className="rail-key">{role.glyph}</span>
            {role.label}
          </button>
        ))}
      </div>
      <button type="button" className="btn tiny" onClick={() => api.setRole(null)}>
        Ingen rolle
      </button>
      <button type="button" className="btn tiny" onClick={() => api.setRoleHidden(true)}>
        Skjul ikon
      </button>
    </Popover>
  );
}

export function ViewMenu({
  onClose,
  anchorRef,
}: {
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const api = useEditor();
  const items: { label: string; on: boolean; toggle: () => void }[] = [
    { label: 'Kommentarer', on: api.project.showComments, toggle: api.toggleCommentsVisible },
    { label: 'Rolleikon', on: api.project.showRoleIcons, toggle: api.toggleRoleIcons },
    { label: 'Forklaring', on: api.project.showRelationLegend, toggle: api.toggleRelationLegend },
    { label: 'Rammenavn', on: api.project.showFrameLegend, toggle: api.toggleFrameLegend },
  ];
  return (
    <Popover className="popover-menu" prefer="below" anchorRef={anchorRef} onClose={onClose}>
      {items.map((item) => (
        <button key={item.label} type="button" className={item.on ? 'rail-btn active' : 'rail-btn'} aria-pressed={item.on} onClick={item.toggle}>
          {item.label}
        </button>
      ))}
    </Popover>
  );
}

export function SettingsMenu({
  onClose,
  anchorRef,
}: {
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const api = useEditor();
  return (
    <Popover className="popover-menu" prefer="below" anchorRef={anchorRef} onClose={onClose}>
      <LineBreakOptions value={api.project.lineBreaks} onChange={api.setLineBreaks} />
      <p className="panel-note">
        Dine egne linjeskift beholdes. Valgte tegn starter en ny rad i tillegg. Bryt linjer på nytt flytter ordene uten å fjerne piler, grupper eller rammer.
      </p>
      <button type="button" className="btn tiny block" disabled={api.project.blocks.length === 0} onClick={api.reflowLines}>
        Bryt linjer på nytt
      </button>
    </Popover>
  );
}

export function ExportMenu({
  onClose,
  anchorRef,
}: {
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const api = useEditor();
  const prefs = api.project.exportPrefs;
  const hasSelection = api.selection.length > 0;

  const run = async (kind: 'png' | 'svg', selection: boolean) => {
    const built = buildExportSvg(api.project, {
      selection: selection ? api.selection : null,
      hideComments: prefs.hideComments,
      hideGuides: prefs.hideGuides,
    });
    const filename = projectFilename(api.project.reference, new Date(), kind);
    if (kind === 'svg') downloadText(filename, built.svg, 'image/svg+xml');
    else {
      try {
        await downloadSvgAsPng(built.svg, built.width, built.height, filename);
      } catch {
        api.notify('Kunne ikke lage PNG. Prøv SVG.');
      }
    }
    onClose();
  };

  return (
    <Popover className="popover-menu" prefer="below" anchorRef={anchorRef} onClose={onClose}>
      <p className="menu-label">Eksporter</p>
      <label className="check">
        <input type="checkbox" checked={prefs.hideComments} onChange={(event) => api.setExportPrefs({ hideComments: event.target.checked })} />
        Skjul kommentarer
      </label>
      <label className="check">
        <input type="checkbox" checked={prefs.hideGuides} onChange={(event) => api.setExportPrefs({ hideGuides: event.target.checked })} />
        Skjul rutenett
      </label>
      <div className="segment">
        <button type="button" className="btn tiny" onClick={() => void run('png', false)}>
          PNG, hele
        </button>
        <button type="button" className="btn tiny" onClick={() => void run('svg', false)}>
          SVG, hele
        </button>
      </div>
      <div className="segment">
        <button type="button" className="btn tiny" disabled={!hasSelection} onClick={() => void run('png', true)}>
          PNG, utvalg
        </button>
        <button type="button" className="btn tiny" disabled={!hasSelection} onClick={() => void run('svg', true)}>
          SVG, utvalg
        </button>
      </div>
    </Popover>
  );
}
