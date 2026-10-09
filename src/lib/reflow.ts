import type { Block, Project } from '../types';
import { analyzeText } from './classify';
import { BLOCK_H, ROW_GAP, WORD_GAP, layoutAnalysis } from './layout';
import { splitTokenLines } from './lineBreaks';

const ROW_TOLERANCE = BLOCK_H / 2;

export type ReflowResult =
  | { status: 'empty' }
  | { status: 'same' }
  | { status: 'edited' }
  | { status: 'ok'; blocks: Block[] };

export function blocksInReadingOrder<T extends { x: number; y: number }>(blocks: T[]): T[] {
  const pending = [...blocks].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: T[][] = [];
  for (const block of pending) {
    const row = rows.find((items) => Math.abs(items[0].y - block.y) <= ROW_TOLERANCE);
    if (row) row.push(block);
    else rows.push([block]);
  }
  return rows.flatMap((row) => [...row].sort((a, b) => a.x - b.x));
}

function clusterRows<T extends { y: number }>(ordered: T[]): T[][] {
  const rows: T[][] = [];
  for (const block of ordered) {
    const row = rows[rows.length - 1];
    if (!row || Math.abs(row[0].y - block.y) > ROW_TOLERANCE) rows.push([block]);
    else row.push(block);
  }
  return rows;
}

function applyPositions(blocks: Block[], positions: Map<string, { x: number; y: number }>): ReflowResult {
  let changed = false;
  const next = blocks.map((block) => {
    const position = positions.get(block.id);
    if (!position || (position.x === block.x && position.y === block.y)) return block;
    changed = true;
    return { ...block, x: position.x, y: position.y };
  });
  if (!changed) return { status: 'same' };
  return { status: 'ok', blocks: next };
}

function reflowFromSource(project: Project, measure: (text: string) => number): ReflowResult | null {
  const analysis = analyzeText(project.sourceText);
  const drafts = layoutAnalysis(analysis, {
    includeVerseNumbers: false,
    measure,
    lineBreaks: project.lineBreaks,
  });
  const ordered = blocksInReadingOrder(project.blocks);
  const sameText =
    drafts.length === ordered.length && drafts.every((draft, index) => draft.text === ordered[index]?.text);
  if (!sameText) return null;
  const positions = new Map<string, { x: number; y: number }>();
  ordered.forEach((block, index) => {
    const draft = drafts[index];
    if (draft) positions.set(block.id, { x: draft.x, y: draft.y });
  });
  return applyPositions(project.blocks, positions);
}

/** Older files have no stored source. Split the rows that are already on the canvas. */
function reflowCurrentRows(blocks: Block[], project: Project, measure: (text: string) => number): ReflowResult {
  const rows = clusterRows(blocksInReadingOrder(blocks));
  const originX = Math.min(...blocks.map((block) => block.x));
  const originY = Math.min(...blocks.map((block) => block.y));
  const positions = new Map<string, { x: number; y: number }>();
  let y = originY;
  for (const row of rows) {
    for (const line of splitTokenLines(row, project.lineBreaks)) {
      let x = originX;
      for (const block of line) {
        positions.set(block.id, { x, y });
        x += measure(block.text) + WORD_GAP;
      }
      y += BLOCK_H + ROW_GAP;
    }
  }
  return applyPositions(blocks, positions);
}

/**
 * Move blocks into rows for the current punctuation settings.
 * Block ids stay put, so arrows, groups and frames keep their targets.
 * Returns edited when the stored import no longer matches the words on the canvas.
 */
export function reflowBlocks(project: Project, measure: (text: string) => number): ReflowResult {
  if (project.blocks.length === 0) return { status: 'empty' };
  if (project.sourceText.trim()) {
    const fromSource = reflowFromSource(project, measure);
    if (!fromSource) return { status: 'edited' };
    return fromSource;
  }
  return reflowCurrentRows(project.blocks, project, measure);
}
