import { describe, expect, it } from 'vitest';
import { tokenizeLine, tokenizePassage } from './tokenize';

describe('tokenizeLine', () => {
  it('fester tegnsetting til ordet foran', () => {
    expect(tokenizeLine('Jesus, ham. dette:')).toEqual(['Jesus,', 'ham.', 'dette:']);
  });

  it('fester åpningsanførsel og parentes til neste ord', () => {
    expect(tokenizeLine('Han sa: «Kom hit.» (nå).')).toEqual(['Han', 'sa:', '«Kom', 'hit.»', '(nå).']);
    expect(tokenizeLine('Han sa: "Kom hit."')).toEqual(['Han', 'sa:', '"Kom', 'hit."']);
  });

  it('holder kapittel:vers og tusenskille som egne tokener', () => {
    expect(tokenizeLine('8:1 Så')).toEqual(['8:1', 'Så']);
    expect(tokenizeLine('8,1 Så')).toEqual(['8,1', 'Så']);
    expect(tokenizeLine('tallet 144 000 merket')).toEqual(['tallet', '144', '000', 'merket']);
  });

  it('behandler hardt mellomrom i 144 000 som vanlig mellomrom', () => {
    expect(tokenizePassage('144\u00A0000').map((row) => row.tokens)).toEqual([['144', '000']]);
  });
});

describe('tokenizePassage', () => {
  it('lar linjeskift starte ny rad og beholder tomme rader', () => {
    expect(tokenizePassage('alfa beta\n\ngamma').map((row) => row.tokens)).toEqual([
      ['alfa', 'beta'],
      [],
      ['gamma'],
    ]);
  });
});
