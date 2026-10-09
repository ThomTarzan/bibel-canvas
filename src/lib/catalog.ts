import type { ConnectorKind, LogicRole, RelationId } from '../types';

export interface RelationInfo {
  id: RelationId;
  label: string;
  /** Short help shown as a tooltip and in the legend. */
  help?: string;
}

/** The eight relation names, in keyboard order 1–8. */
export const RELATIONS: RelationInfo[] = [
  { id: 'årsak', label: 'årsak' },
  { id: 'hensikt', label: 'hensikt' },
  { id: 'resultat', label: 'resultat' },
  { id: 'betingelse', label: 'betingelse' },
  { id: 'innsømmelse', label: 'innsømmelse' },
  { id: 'tid', label: 'tid' },
  { id: 'sammenligning', label: 'sammenligning' },
  { id: 'middel', label: 'middel', help: 'Middel eller ledsagende omstendighet' },
];

export const CONNECTORS: { id: ConnectorKind; label: string; glyph: string }[] = [
  { id: 'apposisjon', label: 'Apposisjon', glyph: '=' },
  { id: 'motsetning', label: 'Motsetning', glyph: '≠' },
  { id: 'tillegg', label: 'Tillegg', glyph: '+' },
  { id: 'konklusjon', label: 'Konklusjon', glyph: '∴' },
];

export const LOGIC_ROLES: { id: LogicRole; label: string; glyph: string }[] = [
  { id: 'hovedpåstand', label: 'Hovedpåstand', glyph: '●' },
  { id: 'grunn', label: 'Grunn', glyph: '⊥' },
  { id: 'følge', label: 'Følge', glyph: '→' },
  { id: 'formål', label: 'Formål', glyph: '◎' },
  { id: 'motsetning', label: 'Motsetning', glyph: '≠' },
  { id: 'forklaring', label: 'Forklaring', glyph: '∗' },
  { id: 'sitat', label: 'Sitat', glyph: '«' },
  { id: 'spørsmål', label: 'Spørsmål', glyph: '?' },
];

export function relationById(id: RelationId): RelationInfo {
  const found = RELATIONS.find((item) => item.id === id);
  if (!found) throw new Error(`Ukjent relasjon: ${id}`);
  return found;
}

export function relationCaption(id: RelationId | null, label: string): string {
  if (id) return relationById(id).label;
  return label;
}
