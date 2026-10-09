import { describe, expect, it } from 'vitest';
import { projectFilename } from './filename';
import { buildExportSvg } from './exportSvg';
import { emptyProject } from './project';
import type { Project } from '../types';

function sample(): Project {
  const project = emptyProject('2026-10-09T00:00:00.000Z');
  project.reference = 'Rom 8,1–4';
  project.blocks = [
    {
      id: 'b1',
      text: 'Så',
      x: 40,
      y: 80,
      kind: 'word',
      uncertain: false,
      fill: '#f5c400',
      textColor: null,
      groupId: null,
      role: 'grunn',
      roleHidden: false,
      fontSize: null,
      fontWeight: null,
      fontFamily: null,
    },
  ];
  project.arrows = [
    {
      id: 'p1',
      fromId: '',
      toId: 'b1',
      label: '',
      style: 'straight',
      color: null,
      relation: 'årsak',
      from: { x: 20, y: 40, targetId: null, edge: false },
      to: { x: 0, y: 17, targetId: 'b1', edge: false },
    },
  ];
  project.comments = [{ id: 'c1', targetId: 'b1', x: 8, y: 0, text: 'Hemmelig notat', minimized: false, anchored: true }];
  project.frames = [{ id: 'f1', targetId: 'b1', colorId: project.frameColors[0].id, thickness: 3, style: 'solid' }];
  return project;
}

describe('eksport', () => {
  it('bruker samme filnavn som JSON, med annet suffiks', () => {
    expect(projectFilename('Rom 8,1–4', new Date(2026, 9, 9), 'png')).toBe('Rom-8-1-4_2026-10-09.png');
    expect(projectFilename('Rom 8,1–4', new Date(2026, 9, 9), 'svg')).toBe('Rom-8-1-4_2026-10-09.svg');
  });

  it('tar med relasjon og rammenavn, og kan skjule kommentar og rutenett', () => {
    const project = sample();
    const shown = buildExportSvg(project, { selection: null, hideComments: false, hideGuides: false });
    expect(shown.svg).toContain('årsak');
    expect(shown.svg).toContain('subjekt');
    expect(shown.svg).toContain('Hemmelig notat');
    expect(shown.svg).toContain('id="guides"');
    expect(shown.svg).toContain('id="frame-legend"');

    const hidden = buildExportSvg(project, { selection: null, hideComments: true, hideGuides: true });
    expect(hidden.svg).not.toContain('Hemmelig notat');
    expect(hidden.svg).not.toContain('id="guides"');
    expect(hidden.svg).toContain('subjekt');
  });

  it('utelater rammeforklaringen når den er skjult', () => {
    const project = sample();
    project.showFrameLegend = false;
    const svg = buildExportSvg(project, { selection: null, hideComments: true, hideGuides: true }).svg;
    expect(svg).not.toContain('id="frame-legend"');
  });
});
