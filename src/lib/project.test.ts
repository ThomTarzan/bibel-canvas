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
    project.comments = [{ id: 'c1', targetId: null, x: 1, y: 2, text: 'Notat', minimized: true }];
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
  });

  it('avviser ukjent form', () => {
    expect(parseProject(null)).toBeNull();
    expect(parseProject({ version: 2, blocks: [] })).toBeNull();
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
