import { describe, expect, it } from 'vitest';
import { createEditorState, reduce } from './editor';

const ROM_GLUED = `1Så er det da ingen fordømmelse for dem som er i Kristus Jesus.
2For Åndens lov, som gir liv, har i Kristus Jesus frigjort deg.
3Det som var umulig for loven, det gjorde Gud.
4Slik skulle lovens krav bli oppfylt.`;

const REVELATION = `4 Og jeg hørte tallet: 144 000 merket.
5 Av Juda stamme tolv tusen.
6 og 40 dager ble nevnt.`;

const NOW = '2026-10-08T12:00:00.000Z';

describe('import og angre', () => {
  it('legger ord på lerretet, varsler om fjernede vers og kan angre', () => {
    const imported = reduce(createEditorState(), {
      type: 'import-text',
      text: ROM_GLUED,
      reference: 'Rom 8,1–4',
      now: NOW,
    });
    expect(imported.project.reference).toBe('Rom 8,1–4');
    expect(imported.project.blocks[0]?.text).toBe('Så');
    expect(imported.project.blocks.some((block) => block.text === '1')).toBe(false);
    expect(imported.toast).toEqual({ message: 'Fjernet 4 versnumre', offerUndo: true });

    const withNumbers = reduce(imported, { type: 'undo' });
    expect(withNumbers.project.blocks[0]?.text).toBe('1');
    expect(withNumbers.project.blocks[1]?.text).toBe('Så');
    expect(withNumbers.toast).toBeNull();

    const empty = reduce(withNumbers, { type: 'undo' });
    expect(empty.project.blocks).toHaveLength(0);

    const redone = reduce(empty, { type: 'redo' });
    expect(redone.project.blocks[0]?.text).toBe('1');
  });

  it('sletter alle tall og kan angre, men lar tolv stå', () => {
    const imported = reduce(createEditorState(), {
      type: 'import-text',
      text: REVELATION,
      reference: 'Åp 7',
      now: NOW,
    });
    expect(imported.project.blocks.some((block) => block.text === '144')).toBe(true);
    expect(imported.project.blocks.some((block) => block.text === 'tolv')).toBe(true);

    const cleared = reduce(imported, { type: 'delete-all-numbers' });
    expect(cleared.project.blocks.some((block) => block.kind === 'number')).toBe(false);
    expect(cleared.project.blocks.some((block) => block.text === 'tolv')).toBe(true);

    const restored = reduce(cleared, { type: 'undo' });
    expect(restored.project.blocks.some((block) => block.text === '144')).toBe(true);
    expect(restored.project.blocks.some((block) => block.text === '000')).toBe(true);
    expect(restored.project.blocks.some((block) => block.text === '40')).toBe(true);
  });

  it('sletter ett tall uten å røre de andre', () => {
    const imported = reduce(createEditorState(), {
      type: 'import-text',
      text: 'Han gikk i 40 dager.',
      reference: '',
      now: NOW,
    });
    const forty = imported.project.blocks.find((block) => block.text === '40');
    expect(forty?.kind).toBe('number');
    const next = reduce(imported, { type: 'delete-ids', ids: [forty!.id] });
    expect(next.project.blocks.some((block) => block.text === '40')).toBe(false);
    expect(next.project.blocks.some((block) => block.text === 'dager.')).toBe(true);
    expect(reduce(next, { type: 'undo' }).project.blocks.some((block) => block.text === '40')).toBe(true);
  });
});

describe('grupper, fraser og piler', () => {
  it('grupperer, slår sammen, deler opp og flytter med angre', () => {
    let state = reduce(createEditorState(), {
      type: 'import-text',
      text: 'Alfa beta gamma',
      reference: 'Test',
      now: NOW,
    });
    const [alfa, beta] = state.project.blocks;
    state = reduce(state, { type: 'group', blockIds: [alfa.id, beta.id] });
    expect(state.project.groups).toHaveLength(1);
    expect(state.project.blocks.find((block) => block.id === alfa.id)?.groupId).toBe(state.project.groups[0]?.id);
    expect(state.project.blocks.find((block) => block.id === beta.id)?.groupId).toBe(state.project.groups[0]?.id);

    state = reduce(state, { type: 'merge', blockIds: [alfa.id, beta.id] });
    expect(state.project.blocks.map((block) => block.text)).toEqual(['Alfa beta', 'gamma']);

    const phrase = state.project.blocks[0];
    state = reduce(state, { type: 'split', blockId: phrase.id });
    expect(state.project.blocks.map((block) => block.text)).toEqual(['Alfa', 'beta', 'gamma']);

    const movedFrom = state.project.blocks[2];
    state = reduce(state, {
      type: 'commit-move',
      positions: [{ id: movedFrom.id, x: movedFrom.x + 48, y: movedFrom.y }],
    });
    expect(state.project.blocks.find((block) => block.id === movedFrom.id)?.x).toBe(movedFrom.x + 48);
    expect(reduce(state, { type: 'undo' }).project.blocks.find((block) => block.id === movedFrom.id)?.x).toBe(movedFrom.x);
  });

  it('beholder pilens endepunkter når brikkene flyttes', () => {
    let state = reduce(createEditorState(), {
      type: 'import-text',
      text: 'Alfa beta',
      reference: 'Test',
      now: NOW,
    });
    const [alfa, beta] = state.project.blocks;
    state = reduce(state, {
      type: 'add-arrow',
      arrow: { id: 'p1', fromId: alfa.id, toId: beta.id, label: 'Grunn', style: 'curved', color: '#3f4f42' },
    });
    state = reduce(state, {
      type: 'commit-move',
      positions: [{ id: beta.id, x: beta.x + 80, y: beta.y + 40 }],
    });
    expect(state.project.arrows[0]).toMatchObject({ fromId: alfa.id, toId: beta.id, label: 'Grunn', style: 'curved' });
    expect(state.project.blocks.find((block) => block.id === beta.id)?.y).toBe(beta.y + 40);
  });
});
