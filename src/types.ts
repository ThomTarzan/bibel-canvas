/** Data model for round 1. Fields for icons, comments and fonts are reserved for round 2. */

export type LogicRole =
  | 'hovedpåstand'
  | 'grunn'
  | 'følge'
  | 'formål'
  | 'motsetning'
  | 'forklaring'
  | 'sitat'
  | 'spørsmål';

export type FontFamilyId = 'elegant' | 'neutral';

export type ArrowStyle = 'straight' | 'curved' | 'dashed';

export interface Block {
  id: string;
  text: string;
  x: number;
  y: number;
  kind: 'word' | 'number';
  /** Kept number whose role in the text is uncertain. */
  uncertain: boolean;
  fill: string | null;
  textColor: string | null;
  groupId: string | null;
  /** Reserved: logic-role icon. Null until round 2. */
  role: LogicRole | null;
  /** Reserved: hide the role icon without deleting it. */
  roleHidden: boolean;
  /** Reserved: per-block font overrides. Null follows the project default. */
  fontSize: number | null;
  fontWeight: number | null;
  fontFamily: FontFamilyId | null;
}

export interface Group {
  id: string;
  blockIds: string[];
  fill: string | null;
}

export interface Arrow {
  id: string;
  fromId: string;
  toId: string;
  /** Preset name or free text. Empty string means no label. */
  label: string;
  style: ArrowStyle;
  color: string | null;
}

/** Reserved for round 2. Stored so files can already carry comments. */
export interface Comment {
  id: string;
  targetId: string | null;
  x: number;
  y: number;
  text: string;
  minimized: boolean;
}

export interface TypographySettings {
  fontFamily: FontFamilyId;
  fontSize: number;
  fontWeight: number;
}

export interface ExportPrefs {
  hideComments: boolean;
  hideGuides: boolean;
}

export interface Project {
  version: 1;
  reference: string;
  createdAt: string;
  updatedAt: string;
  grid: boolean;
  snap: boolean;
  blocks: Block[];
  groups: Group[];
  arrows: Arrow[];
  comments: Comment[];
  typography: TypographySettings;
  exportPrefs: ExportPrefs;
}

export const RELATIONS: { id: string; label: string }[] = [
  { id: 'grunn', label: 'Grunn' },
  { id: 'følge', label: 'Følge' },
  { id: 'motsetning', label: 'Motsetning' },
  { id: 'formål', label: 'Formål' },
  { id: 'forklaring', label: 'Forklaring' },
  { id: 'tid', label: 'Tid' },
  { id: 'måte', label: 'Måte' },
];
