import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('keeps valid fields and replaces invalid fields independently', () => {
    const settings = normalizeSettings({
      schemaVersion: 1,
      rootFolder: 'Personal/Focus',
      firstWeekday: 0,
      wip: {
        sprintScope: { mode: 'hard', limit: 12 },
        tomorrow: { mode: 'unknown', limit: 3 },
        today: { mode: 'off', limit: -1 },
      },
      templates: {
        candidate: 'Templates/Candidate.md',
        story: 'Templates/Focus Story.md',
        task: 'Templates/Task.md',
        mission: 'Templates/Mission.md',
        retrospective: 'Templates/Retrospective.md',
      },
    });

    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      rootFolder: 'Personal/Focus',
      firstWeekday: 0,
      wip: {
        ...DEFAULT_SETTINGS.wip,
        sprintScope: { mode: 'hard', limit: 12 },
        tomorrow: { mode: 'soft', limit: 3 },
        today: { mode: 'off', limit: 7 },
      },
      templates: {
        candidate: 'Templates/Candidate.md',
        task: 'Templates/Task.md',
        retrospective: 'Templates/Retrospective.md',
      },
    });
  });

  it('normalizes first-use setup independently from the root contents', () => {
    expect(normalizeSettings({ setupCompleted: true }).setupCompleted).toBe(true);
    expect(normalizeSettings({ setupCompleted: 'yes' }).setupCompleted).toBe(false);
  });

  it('normalizes the persisted accent preference independently', () => {
    expect(normalizeSettings({}).appearance.accent).toEqual({ source: 'obsidian' });
    expect(normalizeSettings({ appearance: { accent: { source: 'indigo' } } }).appearance.accent).toEqual({ source: 'indigo' });
    expect(normalizeSettings({ appearance: { accent: { source: 'custom', seed: '#0f766e' } } }).appearance.accent).toEqual({ source: 'custom', seed: '#0F766E' });
    expect(normalizeSettings({ appearance: { accent: { source: 'custom', seed: 'teal' } } }).appearance.accent).toEqual({ source: 'obsidian' });
  });
});
