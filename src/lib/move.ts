import type { Project } from '../types';

/** Blocks that should move together: a selected block drags its whole group. */
export function blockIdsToMove(project: Project, selected: string[]): string[] {
  const ids = new Set<string>();
  for (const id of selected) {
    const block = project.blocks.find((item) => item.id === id);
    if (block) {
      if (block.groupId) {
        for (const other of project.blocks) {
          if (other.groupId === block.groupId) ids.add(other.id);
        }
      } else {
        ids.add(block.id);
      }
    }
    const group = project.groups.find((item) => item.id === id);
    if (group) group.blockIds.forEach((blockId) => ids.add(blockId));
  }
  return [...ids];
}
