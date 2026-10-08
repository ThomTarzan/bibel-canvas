import { tokenizePassage } from './tokenize';

/**
 * Verse/chapter number detection.
 *
 * Confident removals (combined heuristics):
 * - digits glued to a word ("1Så", "2Men", "4for"), unless the word is a quantity noun
 * - superscript digits
 * - chapter:verse with a colon ("8:1", "8:1–4")
 * - "8,1" at a line start, after a sentence, or when several appear
 * - small integers at line start or right after a sentence, especially an ascending run
 *
 * Kept on purpose:
 * - grouped thousands ("144 000", "1 500 menn", "144.000")
 * - numbers followed by a quantity noun ("40 dager") or a quantity adverb ("omtrent 12")
 * - number words such as "tolv" (they are ordinary words)
 * - integers too large to be a verse
 *
 * Anything numeric that is still ambiguous is kept and marked uncertain.
 */

export type TokenRole = 'word' | 'kept-number' | 'uncertain-number' | 'verse-number';

export interface ClassifiedToken {
  text: string;
  role: TokenRole;
}

export interface ClassifiedRow {
  tokens: ClassifiedToken[];
}

export interface Analysis {
  rows: ClassifiedRow[];
  removedVerseNumbers: string[];
}

const QUANTITY = new Set([
  'dag', 'dager', 'dagen', 'døgn', 'natt', 'netter', 'natten', 'år', 'året', 'årene',
  'time', 'timer', 'minutt', 'minutter', 'sekund', 'sekunder',
  'måned', 'måneder', 'uke', 'uker', 'gang', 'ganger',
  'mann', 'mannen', 'menn', 'mennene', 'kvinne', 'kvinner', 'barn', 'barna',
  'sønn', 'sønner', 'datter', 'døtre', 'bror', 'brødre', 'søster', 'søstre',
  'stamme', 'stammen', 'stammer', 'stammene',
  'disippel', 'disipler', 'disiplene', 'apostel', 'apostler', 'apostlene',
  'engel', 'engler', 'englene', 'profet', 'profeter',
  'brød', 'fisk', 'fisker', 'fiskene', 'segl', 'basun', 'basuner',
  'stjerne', 'stjerner', 'talent', 'talenter', 'sekel', 'sikler', 'alen',
  'krone', 'kroner', 'denar', 'denarer', 'mynt', 'mynter',
  'person', 'personer', 'folk', 'folket', 'sjel', 'sjeler',
  'lam', 'lammet', 'okse', 'okser', 'due', 'duer', 'geit', 'geiter', 'sau', 'sauer',
  'by', 'byer', 'land', 'rike', 'riker', 'nasjon', 'nasjoner',
  'tusen', 'tusener', 'hundre', 'hundrer', 'million', 'millioner',
  'menneske', 'mennesker', 'menneskene',
  'slag', 'slags', 'mål', 'kilo', 'gram', 'meter', 'km', 'liter',
  'fot', 'stadier', 'favn', 'favner', 'skål', 'skåler',
  'gammel', 'gamle', 'kurv', 'kurver', 'spann',
]);

const QUANTITY_PREFIX = new Set([
  'ca', 'cirka', 'omtrent', 'omlag', 'omkring', 'rundt', 'minst', 'høyst', 'over', 'under', 'om',
]);

const SUPERSCRIPT: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

const MAX_VERSE = 176;

interface Draft {
  text: string;
  role: TokenRole | 'pending';
  /** Parsed integer, when the token is a bare number. */
  value: number | null;
  /** Chapter:verse written with a comma, decided in a later pass. */
  commaRef: string | null;
  row: number;
}

function numericCore(text: string): string {
  let s = text.replace(/^[«"“‘(\[]+/u, '').replace(/[.»"”’)\]%]+$/u, '');
  s = s.replace(/[.!?;:…]+$/u, '');
  if (s.endsWith(',')) s = s.slice(0, -1);
  return s;
}

function stem(text: string): string {
  const core = text.replace(/^[«"“‘(\[]+/u, '').replace(/[.,;:!?…»"”’)\]%–—-]+$/u, '');
  return core.toLocaleLowerCase('nb');
}

function firstLetter(text: string): string | null {
  const match = text.match(/\p{L}/u);
  return match ? match[0] : null;
}

function isUpperWord(text: string): boolean {
  const ch = firstLetter(text);
  if (!ch) return false;
  const upper = ch.toLocaleUpperCase('nb');
  const lower = ch.toLocaleLowerCase('nb');
  return ch === upper && upper !== lower;
}

function endsSentence(text: string): boolean {
  const stripped = text.replace(/[»"”’)\]%]+$/u, '');
  return /[.!?…]$/u.test(stripped);
}

function fromSuperscript(value: string): string {
  return [...value].map((ch) => SUPERSCRIPT[ch] ?? ch).join('');
}

function asKept(text: string, row: number): Draft {
  return { text, role: 'kept-number', value: null, commaRef: null, row };
}

function asWord(text: string, row: number): Draft {
  return { text, role: 'word', value: null, commaRef: null, row };
}

function asVerse(label: string, row: number): Draft {
  return { text: label, role: 'verse-number', value: null, commaRef: null, row };
}

function asPendingInt(text: string, value: number, row: number): Draft {
  return { text, role: 'pending', value, commaRef: null, row };
}

/** Split one raw token into one or two drafts. Glue and superscripts are resolved here. */
function expandToken(raw: string, row: number): Draft[] {
  // Only treat as glue when there is a letter part. "40." is an integer with punctuation, not glue.
  const glue = raw.match(
    /^([«"“‘(\[]*)([0-9]{1,3})(\p{L}[\p{L}'’-]*)([.,;:!?…»"”’)\]%–—-]*)$/u,
  );
  if (glue && glue[3]) {
    const number = glue[2];
    const word = `${glue[1]}${glue[3]}${glue[4] ?? ''}`;
    if (QUANTITY.has(stem(glue[3]))) {
      return [asKept(number, row), asWord(word, row)];
    }
    return [asVerse(number, row), asWord(word, row)];
  }

  const sup = raw.match(
    /^([«"“‘(\[]*)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)(\p{L}[\p{L}'’.-]*)?([.,;:!?…»"”’)\]%–—-]*)$/u,
  );
  if (sup) {
    const number = fromSuperscript(sup[2]);
    const wordBody = sup[3] ?? '';
    if (!wordBody) return [asVerse(number, row)];
    return [asVerse(number, row), asWord(`${sup[1]}${wordBody}${sup[4] ?? ''}`, row)];
  }

  const core = numericCore(raw);
  if (/^\d{1,3}:\d{1,3}(?:[–—-]\d{1,3})?$/u.test(core)) {
    return [asVerse(core, row)];
  }
  if (/^\d{1,3},\d{1,3}(?:[–—-]\d{1,3})?$/u.test(core)) {
    return [{ text: raw, role: 'pending', value: null, commaRef: core, row }];
  }
  if (/^\d{1,3}(?:\.\d{3})+$/u.test(core)) {
    return [asKept(raw, row)];
  }
  if (/^\d+$/u.test(core)) {
    const value = Number(core);
    if (value > MAX_VERSE) return [asKept(raw, row)];
    return [asPendingInt(raw, value, row)];
  }

  return [asWord(raw, row)];
}

function mark(draft: Draft, role: TokenRole): void {
  draft.role = role;
}

export function analyzeText(text: string): Analysis {
  const rawRows = tokenizePassage(text);
  const drafts: Draft[] = [];
  rawRows.forEach((raw, row) => {
    for (const token of raw.tokens) drafts.push(...expandToken(token, row));
  });

  // Grouped thousands: "144 000", "1 500 menn", mid-sentence "1 500".
  for (let i = 0; i < drafts.length - 1; i += 1) {
    const a = drafts[i];
    const b = drafts[i + 1];
    if (a.role !== 'pending' || b.role !== 'pending') continue;
    if (a.value == null || b.row !== a.row) continue;
    const bCore = numericCore(b.text);
    if (!/^\d{3}$/u.test(bCore)) continue;
    const aCore = numericCore(a.text);
    if (!/^\d{1,3}$/u.test(aCore)) continue;

    const after = drafts[i + 2];
    const followedByNoun = Boolean(after && after.row === b.row && QUANTITY.has(stem(after.text)));
    const lineStart = drafts.slice(0, i).every((item) => item.row !== a.row);
    const prev = drafts[i - 1];
    const afterSentence = Boolean(prev && endsSentence(prev.text));
    const thousands =
      bCore === '000' ||
      followedByNoun ||
      (!lineStart && !afterSentence);

    if (thousands) {
      mark(a, 'kept-number');
      mark(b, 'kept-number');
      let k = i + 2;
      while (k < drafts.length && drafts[k].row === a.row && drafts[k].role === 'pending') {
        const more = numericCore(drafts[k].text);
        if (!/^\d{3}$/u.test(more)) break;
        mark(drafts[k], 'kept-number');
        k += 1;
      }
    }
  }

  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    if (draft.role !== 'pending' || draft.value == null) continue;
    const next = drafts[i + 1];
    const prev = drafts[i - 1];
    if (next && next.row === draft.row && QUANTITY.has(stem(next.text))) {
      mark(draft, 'kept-number');
      continue;
    }
    if (prev) {
      const prevStem = stem(prev.text);
      const before = drafts[i - 2];
      const bigram = before ? `${stem(before.text)} ${prevStem}` : '';
      const abbreviation = /^(ca\.?|cirka)$/iu.test(prev.text.trim());
      if ((!endsSentence(prev.text) || abbreviation) && (QUANTITY_PREFIX.has(prevStem) || bigram === 'om lag')) {
        mark(draft, 'kept-number');
      }
    }
  }

  const commaRefs = drafts.filter((draft) => draft.commaRef);
  const repeatedComma = commaRefs.length >= 2;

  const isLineStart = (index: number): boolean => {
    const row = drafts[index].row;
    for (let j = 0; j < index; j += 1) if (drafts[j].row === row) return false;
    return true;
  };

  const nextIsUpper = (index: number): boolean => {
    const next = drafts[index + 1];
    return Boolean(next && next.row === drafts[index].row && isUpperWord(next.text));
  };

  const endOfLine = (index: number): boolean => {
    const next = drafts[index + 1];
    return !next || next.row !== drafts[index].row;
  };

  const afterSentence = (index: number): boolean => {
    const prev = drafts[index - 1];
    return Boolean(prev && endsSentence(prev.text));
  };

  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    if (draft.commaRef) {
      if (isLineStart(i) || afterSentence(i) || repeatedComma) mark(draft, 'verse-number');
      else mark(draft, 'uncertain-number');
      continue;
    }
    if (draft.role !== 'pending' || draft.value == null) continue;
    if (draft.value < 1 || draft.value > MAX_VERSE) {
      mark(draft, 'uncertain-number');
      continue;
    }
    const confident =
      (isLineStart(i) && (nextIsUpper(i) || endOfLine(i))) ||
      (afterSentence(i) && (nextIsUpper(i) || endOfLine(i) || i === drafts.length - 1));
    if (confident) mark(draft, 'verse-number');
  }

  // Ascending run. Already removed markers stay as anchors so "4 for" joins 1,2,3.
  const sequence: { index: number; value: number }[] = [];
  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    if (draft.value == null || draft.value < 1 || draft.value > MAX_VERSE) continue;
    const positional =
      draft.role === 'verse-number' ||
      (draft.role === 'pending' &&
        (isLineStart(i) || afterSentence(i) || nextIsUpper(i) || endOfLine(i)));
    if (positional) sequence.push({ index: i, value: draft.value });
  }

  let run: { index: number; value: number }[] = [];
  const closeRun = () => {
    if (run.length >= 2) {
      for (const item of run) {
        if (drafts[item.index].role === 'pending') mark(drafts[item.index], 'verse-number');
      }
    }
    run = [];
  };
  for (const item of sequence) {
    if (run.length === 0 || item.value === run[run.length - 1].value + 1) run.push(item);
    else {
      closeRun();
      run = [item];
    }
  }
  closeRun();

  for (const draft of drafts) {
    if (draft.role === 'pending') mark(draft, draft.value == null ? 'word' : 'uncertain-number');
  }

  const rows: ClassifiedRow[] = rawRows.map(() => ({ tokens: [] }));
  const removedVerseNumbers: string[] = [];
  for (const draft of drafts) {
    const role = draft.role === 'pending' ? 'word' : draft.role;
    const label = draft.commaRef ?? numericCore(draft.text);
    const token: ClassifiedToken = {
      text: role === 'verse-number' ? label : draft.text,
      role,
    };
    if (role === 'verse-number') removedVerseNumbers.push(label);
    rows[draft.row]?.tokens.push(token);
  }

  return { rows, removedVerseNumbers };
}

export function formatRemovedToast(count: number): string {
  if (count === 1) return 'Fjernet 1 versnummer';
  return `Fjernet ${count} versnumre`;
}

/** Used when the user edits or merges text, so a typed number stays deletable. */
export function kindFromText(text: string): { kind: 'word' | 'number'; uncertain: boolean } {
  const trimmed = text.trim();
  const core = numericCore(trimmed);
  if (
    /^\d{1,3}:\d{1,3}(?:[–—-]\d{1,3})?$/u.test(core) ||
    /^\d{1,3},\d{1,3}(?:[–—-]\d{1,3})?$/u.test(core) ||
    /^\d+$/u.test(core) ||
    /^\d{1,3}(?:\.\d{3})+$/u.test(core) ||
    /^\d{1,3}(?:\s\d{3})+$/u.test(trimmed)
  ) {
    return { kind: 'number', uncertain: false };
  }
  return { kind: 'word', uncertain: false };
}
