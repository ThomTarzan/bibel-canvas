import { useState } from 'react';
import { tokenizeLine } from '../lib/tokenize';
import { useEditor } from '../state/EditorContext';
import { ColorPopover } from './ColorPopover';

export function SelectionBar() {
  const api = useEditor();
  const [colorOpen, setColorOpen] = useState(false);
  const blocks = api.project.blocks.filter((block) => api.selection.includes(block.id));
  const groupsSelected = api.selection.some((id) => api.project.groups.some((group) => group.id === id));
  const canGroup = blocks.length >= 2;
  const canUngroup = groupsSelected || blocks.some((block) => block.groupId);
  const canMerge = blocks.length >= 2;
  const canSplit = blocks.length === 1 && tokenizeLine(blocks[0].text).length >= 2;
  const canColor =
    blocks.length > 0 ||
    groupsSelected ||
    api.selection.some((id) => api.project.arrows.some((arrow) => arrow.id === id));

  if (api.selection.length === 0) return null;

  return (
    <div className="selection-bar">
      <span className="count">
        {api.selection.length} valgt
      </span>
      <button type="button" className="btn" disabled={!canGroup} onClick={api.groupSelection} title="Ctrl+G">
        Grupper
      </button>
      <button type="button" className="btn" disabled={!canUngroup} onClick={api.ungroupSelection} title="Ctrl+Shift+G">
        Opphev gruppe
      </button>
      <button type="button" className="btn" disabled={!canMerge} onClick={api.mergeSelection}>
        Slå sammen
      </button>
      <button type="button" className="btn" disabled={!canSplit} onClick={api.splitSelection}>
        Del opp
      </button>
      <div className="color-anchor">
        <button
          type="button"
          className={colorOpen ? 'btn active' : 'btn'}
          disabled={!canColor}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setColorOpen((open) => !open)}
        >
          Farge
        </button>
        {colorOpen && <ColorPopover onClose={() => setColorOpen(false)} />}
      </div>
      <button type="button" className="btn" onClick={api.deleteSelection}>
        Slett
      </button>
    </div>
  );
}
