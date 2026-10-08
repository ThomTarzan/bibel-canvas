import { describe, expect, it } from 'vitest';
import { analyzeText, formatRemovedToast, type Analysis, type TokenRole } from './classify';

function texts(analysis: Analysis, role: TokenRole): string[] {
  return analysis.rows.flatMap((row) => row.tokens.filter((token) => token.role === role).map((token) => token.text));
}

function visible(analysis: Analysis): string {
  return analysis.rows
    .map((row) =>
      row.tokens
        .filter((token) => token.role !== 'verse-number')
        .map((token) => token.text)
        .join(' '),
    )
    .filter((line) => line.length > 0)
    .join('\n');
}

const ROM_GLUED = `1Så er det da ingen fordømmelse for dem som er i Kristus Jesus.
2For Åndens lov, som gir liv, har i Kristus Jesus frigjort deg fra syndens og dødens lov.
3Det som var umulig for loven, det gjorde Gud.
4Slik skulle lovens krav bli oppfylt i oss som ikke lever etter kjøttet, men etter Ånden.`;

const ROM_COLON = `8:1 Så er det da ingen fordømmelse for dem som er i Kristus Jesus.
8:2 For Åndens lov har frigjort deg.
8,3 Det som var umulig for loven, det gjorde Gud.
8,4 Slik skulle lovens krav bli oppfylt.`;

const ROM_LINES = `1 Så er det da ingen fordømmelse for dem som er i Kristus Jesus.
2 For Åndens lov har frigjort deg.
3 Det gjorde Gud.
4 Slik skulle lovens krav bli oppfylt.`;

const REVELATION = `4 Og jeg hørte tallet på de merkede: 144 000 merket av alle Israels stammer.
5 Av Juda stamme tolv tusen merket,
6 av Rubens stamme tolv tusen, og 40 dager ble nevnt i loven.`;

describe('versnumre i Rom 8,1–4', () => {
  it('fjerner sammenlimte versnumre uten å miste ord og tegn', () => {
    const analysis = analyzeText(ROM_GLUED);
    expect(analysis.removedVerseNumbers).toEqual(['1', '2', '3', '4']);
    expect(visible(analysis).split('\n').map((line) => line.split(' ')[0])).toEqual(['Så', 'For', 'Det', 'Slik']);
    expect(visible(analysis)).toContain('Jesus.');
    expect(visible(analysis)).toContain('lov,');
    expect(texts(analysis, 'verse-number')).toEqual(['1', '2', '3', '4']);
  });

  it('fjerner 8:1- og 8,1-stil', () => {
    const analysis = analyzeText(ROM_COLON);
    expect(analysis.removedVerseNumbers).toEqual(['8:1', '8:2', '8,3', '8,4']);
    expect(visible(analysis).split('\n').map((line) => line.split(' ')[0])).toEqual(['Så', 'For', 'Det', 'Slik']);
  });

  it('fjerner versnumre ved linjestart', () => {
    const analysis = analyzeText(ROM_LINES);
    expect(analysis.removedVerseNumbers).toEqual(['1', '2', '3', '4']);
    expect(visible(analysis)).not.toMatch(/(^|\s)\d+(\s|$)/);
    expect(visible(analysis)).toContain('ingen fordømmelse');
  });

  it('fjerner vers som fortsetter med liten bokstav når tallene stiger', () => {
    const analysis = analyzeText('3 Det gjorde Gud.\n4 for at kravet skulle bli oppfylt.');
    expect(analysis.removedVerseNumbers).toEqual(['3', '4']);
    expect(visible(analysis).startsWith('Det gjorde Gud.\nfor at')).toBe(true);
  });

  it('fjerner sammenlimt liten forbokstav og nummer med punktum', () => {
    expect(analyzeText('3Det gjorde Gud.\n4for at kravet skulle gjelde.').removedVerseNumbers).toEqual(['3', '4']);
    const dotted = analyzeText('1. Så er det nåde.\n2. For loven er ånd.');
    expect(dotted.removedVerseNumbers).toEqual(['1', '2']);
    expect(visible(dotted)).toContain('Så er det nåde.');
  });
});

describe('tall som hører til teksten', () => {
  it('bevarer 144 000, tolv og 40 dager', () => {
    const analysis = analyzeText(REVELATION);
    expect(analysis.removedVerseNumbers).toEqual(['4', '5', '6']);
    expect(texts(analysis, 'kept-number')).toEqual(['144', '000', '40']);
    expect(texts(analysis, 'uncertain-number')).toEqual([]);
    expect(visible(analysis)).toContain('144 000');
    expect(visible(analysis)).toContain('tolv tusen');
    expect(visible(analysis)).toContain('40 dager');
  });

  it('bevarer 144 000 med hardt mellomrom og tusen med substantiv', () => {
    const spaced = analyzeText('Tallet er 144\u00A0000 mennesker.');
    expect(spaced.removedVerseNumbers).toEqual([]);
    expect(texts(spaced, 'kept-number')).toEqual(['144', '000']);

    const days = analyzeText('40 dager og 40 netter var han i ørkenen.');
    expect(days.removedVerseNumbers).toEqual([]);
    expect(texts(days, 'kept-number')).toEqual(['40', '40']);
    expect(texts(days, 'uncertain-number')).toEqual([]);
  });

  it('bevarer mengdetall etter omtrent, om lag og ca.', () => {
    expect(texts(analyzeText('Han valgte omtrent 12 disipler den dagen.'), 'kept-number')).toEqual(['12']);
    expect(texts(analyzeText('De gikk om lag 40 dager.'), 'kept-number')).toEqual(['40']);
    expect(analyzeText('Det tok ca. 3 timer.').removedVerseNumbers).toEqual([]);
    expect(texts(analyzeText('Det tok ca. 3 timer.'), 'kept-number')).toEqual(['3']);
  });

  it('bevarer sammenlimt mengde og punktum-tusenskille', () => {
    const glued = analyzeText('40dager og 40netter.');
    expect(glued.removedVerseNumbers).toEqual([]);
    expect(texts(glued, 'kept-number')).toEqual(['40', '40']);
    expect(texts(analyzeText('Tallet var 144.000 mennesker.'), 'kept-number')).toEqual(['144.000']);
  });

  it('marker usikre tall i stedet for å slette dem', () => {
    const loose = analyzeText('Han nevnte 7 og gikk videre.');
    expect(loose.removedVerseNumbers).toEqual([]);
    expect(texts(loose, 'uncertain-number')).toEqual(['7']);

    const chapter = analyzeText('I kapittel 8 står det om nåden.');
    expect(chapter.removedVerseNumbers).toEqual([]);
    expect(texts(chapter, 'uncertain-number')).toEqual(['8']);
  });

  it('fjerner vers etter setningsslutt, også etter ordet over', () => {
    const analysis = analyzeText('Det er nåde. 2 For loven er åndelig. 3 Men kjøttet er svakt.');
    expect(analysis.removedVerseNumbers).toEqual(['2', '3']);
    const afterOver = analyzeText('Han gikk over. 2 For veien var lang. 3 Men de fortsatte.');
    expect(afterOver.removedVerseNumbers).toEqual(['2', '3']);
  });

  it('lar hevet skrift være versnummer', () => {
    const analysis = analyzeText('¹Derfor er det nåde.\n²For loven dømmer ikke.');
    expect(analysis.removedVerseNumbers).toEqual(['1', '2']);
    expect(visible(analysis).split('\n')[0]?.startsWith('Derfor')).toBe(true);
  });
});

describe('formatRemovedToast', () => {
  it('bøyer versnummer', () => {
    expect(formatRemovedToast(1)).toBe('Fjernet 1 versnummer');
    expect(formatRemovedToast(4)).toBe('Fjernet 4 versnumre');
  });
});
