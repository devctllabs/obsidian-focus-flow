import { describe, expect, it } from 'vitest';
import { activeSprint, closedSprint } from '../../test/storybook/fixtures';
import { analyzeIndexedEntities } from './work-index-analysis';

describe('Sprint placement analysis', () => {
  it('accepts only the lifecycle-specific canonical placement', () => {
    const archivedPath = 'Focus Flow/Sprints/Archive/2026/08/SPR-001.md';
    const canonical = analyzeIndexedEntities(
      [{ entity: closedSprint, path: archivedPath }],
      'Focus Flow',
    );
    expect(canonical.diagnostics).toEqual([]);

    const closedAtRoot = analyzeIndexedEntities(
      [{ entity: closedSprint, path: closedSprint.path }],
      'Focus Flow',
    );
    expect(closedAtRoot.diagnostics).toContainEqual({
      code: 'wrong-folder',
      message: 'Closed Sprint notes belong in Sprints/Archive/2026/08.',
      path: closedSprint.path,
      repair: {
        kind: 'move-note',
        path: closedSprint.path,
        id: closedSprint.id,
        targetFolder: 'Sprints/Archive/2026/08',
      },
    });

    const activeInArchive = analyzeIndexedEntities(
      [{ entity: activeSprint, path: archivedPath }],
      'Focus Flow',
    );
    expect(activeInArchive.diagnostics).toContainEqual({
      code: 'wrong-folder',
      message: 'Active Sprint notes belong in Sprints.',
      path: archivedPath,
      repair: {
        kind: 'move-note',
        path: archivedPath,
        id: activeSprint.id,
        targetFolder: 'Sprints',
      },
    });
  });

  it('reports a Closed Sprint in the wrong archive month', () => {
    const wrongPath = 'Focus Flow/Sprints/Archive/2026/07/SPR-001.md';
    const analysis = analyzeIndexedEntities(
      [{ entity: closedSprint, path: wrongPath }],
      'Focus Flow',
    );

    expect(analysis.diagnostics).toContainEqual({
      code: 'wrong-folder',
      message: 'Closed Sprint notes belong in Sprints/Archive/2026/08.',
      path: wrongPath,
      repair: {
        kind: 'move-note',
        path: wrongPath,
        id: closedSprint.id,
        targetFolder: 'Sprints/Archive/2026/08',
      },
    });
  });
});
