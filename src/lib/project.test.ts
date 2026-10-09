import { describe, expect, it } from 'vitest';
import { arrowGeometry, blockRect } from './geometry';
import { projectFilename } from './filename';
import { makeBlock, parseProject, emptyProject } from './project';

describe('projectFilename', () => {
  it('lager filnavn av referanse og dato', () => {
    expect(projectFilename('Rom 8,1–4', new Date(2026, 9, 8))).toBe('Rom-8-1-4_2026-10-08.json');
    expect(projectFilename('   ', new Date(2026, 9, 8))).toBe('bibeltekst_2026-10-08.json');
  });
});

describe('parseProject', () => {
  it('bevarer reserverte felt for ikon, kommentar og skrift', () => {
    const project = emptyProject('2026-10-08T00:00:00.000Z');
    project.reference = 'Rom 8,1–4';
    project.comments = [{ id: 'c1', targetId: null, x: 1, y: 2, text: 'Notat', minimized: true, anchored: false }];
    project.exportPrefs = { hideComments: true, hideGuides: false };
    project.typography = { fontFamily: 'neutral', fontSize: 19, fontWeight: 600 };
    const block = makeBlock({ text: 'Nåde', x: 10, y: 20, kind: 'word', uncertain: false });
    block.role = 'grunn';
    block.roleHidden = true;
    block.fontFamily = 'elegant';
    block.fontSize = 21;
    block.fontWeight = 600;
    project.blocks = [block];

    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed?.comments[0]).toMatchObject({ text: 'Notat', minimized: true });
    expect(parsed?.blocks[0]).toMatchObject({
      role: 'grunn',
      roleHidden: true,
      fontFamily: 'elegant',
      fontSize: 21,
      fontWeight: 600,
    });
    expect(parsed?.typography).toEqual({ fontFamily: 'neutral', fontSize: 19, fontWeight: 600 });
    expect(parsed?.exportPrefs.hideComments).toBe(true);
    expect(parsed?.lineBreaks).toEqual(project.lineBreaks);
    expect(parsed?.sourceText).toBe('');
  });

  it('avviser ukjent form', () => {
    expect(parseProject(null)).toBeNull();
    expect(parseProject({ version: 3, blocks: [] })).toBeNull();
  });

  it('åpner en versjon 1-fil og flytter den til versjon 2', () => {
    const parsed = parseProject({
      version: 1,
      reference: 'Rom 8,1–4',
      blocks: [
        { id: 'b1', text: 'Så', x: 0, y: 0, kind: 'word' },
        { id: 'b2', text: 'er', x: 48, y: 0, kind: 'word' },
      ],
      arrows: [{ id: 'p1', fromId: 'b1', toId: 'b2', label: 'Grunn', style: 'curved', color: '#3f4f42' }],
      comments: [{ id: 'c1', targetId: null, x: 4, y: 8, text: 'Notat', minimized: false }],
    });
    expect(parsed?.version).toBe(2);
    expect(parsed?.arrows[0]).toMatchObject({
      fromId: 'b1',
      toId: 'b2',
      label: 'Grunn',
      style: 'curved',
      relation: null,
      from: { targetId: 'b1', edge: true },
      to: { targetId: 'b2', edge: true },
    });
    expect(parsed?.comments[0]).toMatchObject({ text: 'Notat', anchored: false });
    expect(parsed?.frameColors.map((entry) => entry.name)).toEqual(['subjekt', 'verb', 'gjentakelse']);
    expect(parsed?.lineBreaks).toMatchObject({ period: true, comma: true });
    expect(parsed?.sourceText).toBe('');
  });

  it('beholder en tom rammeforklaring når den er lagret slik', () => {
    const project = emptyProject('2026-10-08T00:00:00.000Z');
    project.frameColors = [];
    project.showFrameLegend = false;
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed?.frameColors).toEqual([]);
    expect(parsed?.showFrameLegend).toBe(false);
    expect(parsed?.version).toBe(2);
  });
});

describe('arrowGeometry', () => {
  it('treffer kanten mellom to brikker ved siden av hverandre', () => {
    const geom = arrowGeometry(blockRect(0, 0, 100), blockRect(220, 0, 80), 'straight');
    expect(geom).not.toBeNull();
    expect(geom!.x1).toBeGreaterThan(90);
    expect(geom!.x1).toBeLessThan(120);
    expect(geom!.x2).toBeGreaterThan(200);
    expect(geom!.x2).toBeLessThan(230);
    expect(geom!.y1).toBeGreaterThan(10);
    expect(geom!.y1).toBeLessThan(24);
  });
});
