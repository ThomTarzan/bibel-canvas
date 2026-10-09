import type { Block, FontFamilyId, Project, TypographySettings } from '../types';

export interface TextFont {
  family: FontFamilyId;
  size: number;
  weight: number;
}

export const DEFAULT_FONT: TextFont = { family: 'elegant', size: 17, weight: 400 };

export function fontFamilyCss(family: FontFamilyId): string {
  return family === 'neutral'
    ? '"Source Sans 3", "Segoe UI", sans-serif'
    : '"Source Serif 4", Palatino, "Palatino Linotype", Georgia, serif';
}

export function fontCss(font: TextFont): string {
  return `${font.weight} ${font.size}px ${fontFamilyCss(font.family)}`;
}

export function resolveFont(typography: TypographySettings, block?: Pick<Block, 'fontFamily' | 'fontSize' | 'fontWeight'> | null): TextFont {
  return {
    family: block?.fontFamily ?? typography.fontFamily,
    size: block?.fontSize ?? typography.fontSize,
    weight: block?.fontWeight ?? typography.fontWeight,
  };
}

export function projectFont(project: Project, block?: Block | null): TextFont {
  return resolveFont(project.typography, block);
}
