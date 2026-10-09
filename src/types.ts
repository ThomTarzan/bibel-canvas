/** Data model. Version 2 adds relation arrows, symbols, frames and view toggles.
 *  Version 1 files still open and are migrated on load. */

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

export type RelationId =
  | 'årsak'
  | 'hensikt'
  | 'resultat'
  | 'betingelse'
  | 'innsømmelse'
  | 'tid'
  | 'sammenligning'
  | 'middel';

export type ConnectorKind = 'apposisjon' | 'motsetning' | 'tillegg' | 'konklusjon';

export type MarkerKind = 'innskutt' | 'hovedpåstand';

export type FrameStyle = 'solid' | 'dashed';

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
  role: LogicRole | null;
  /** Hide this block's role icon without deleting the role. */
  roleHidden: boolean;
  /** Per-block font overrides. Null follows the project default. */
  fontSize: number | null;
  fontWeight: number | null;
  fontFamily: FontFamilyId | null;
}

export interface Group {
  id: string;
  blockIds: string[];
  fill: string | null;
}

/** One end of an arrow or connector. */
export interface ArrowEnd {
  x: number;
  y: number;
  /** Block or group this end is attached to. Null keeps the end at x,y. */
  targetId: string | null;
  /** When attached, x and y are offsets from the target's top-left, unless edge is set. */
  edge: boolean;
}

export interface Arrow {
  id: string;
  /** Mirrors from.targetId, or '' when that end is free. Kept so version 1 files round-trip. */
  fromId: string;
  toId: string;
  /** Free-text label. Ignored on screen when relation is set. */
  label: string;
  style: ArrowStyle;
  /** Outline colour. Null uses the shared dark neutral. */
  color: string | null;
  relation: RelationId | null;
  from: ArrowEnd;
  to: ArrowEnd;
}

/** Glyph drawn between two points: = ≠ + ∴ */
export interface Connector {
  id: string;
  kind: ConnectorKind;
  fromId: string;
  toId: string;
  from: ArrowEnd;
  to: ArrowEnd;
}

/** Innskutt frames a selection. Hovedpåstand marks each target. */
export interface Marker {
  id: string;
  kind: MarkerKind;
  targetIds: string[];
}

export interface FrameColor {
  id: string;
  color: string;
  name: string;
}

export interface Frame {
  id: string;
  targetId: string;
  colorId: string;
  thickness: number;
  style: FrameStyle;
}

export interface Comment {
  id: string;
  targetId: string | null;
  x: number;
  y: number;
  text: string;
  minimized: boolean;
  /** When true, x and y are offsets from the target anchor and the note follows it. */
  anchored: boolean;
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
  version: 2;
  reference: string;
  createdAt: string;
  updatedAt: string;
  grid: boolean;
  snap: boolean;
  blocks: Block[];
  groups: Group[];
  arrows: Arrow[];
  connectors: Connector[];
  markers: Marker[];
  frameColors: FrameColor[];
  frames: Frame[];
  comments: Comment[];
  typography: TypographySettings;
  exportPrefs: ExportPrefs;
  showRelationLegend: boolean;
  showFrameLegend: boolean;
  showRoleIcons: boolean;
  showComments: boolean;
}

export const PROJECT_VERSION = 2 as const;
