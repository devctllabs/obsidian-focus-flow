import type { WipEnforcement, WipPolicy } from './domain/wip-policy';

export type { WipEnforcement } from './domain/wip-policy';
type WipPolicySettings = WipPolicy;

export type AccentPreference =
  | { source: 'obsidian' }
  | { source: 'indigo' }
  | { source: 'custom'; seed: string };

interface AppearanceSettings {
  accent: AccentPreference;
}

interface TemplatePathSettings {
  candidate: string;
  task: string;
  retrospective: string;
}

export interface FocusFlowSettings {
  schemaVersion: 1;
  setupCompleted: boolean;
  rootFolder: string;
  firstWeekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  wip: {
    sprintScope: WipPolicySettings;
    tomorrow: WipPolicySettings;
    today: WipPolicySettings;
    inProgress: WipPolicySettings;
  };
  templates: TemplatePathSettings;
  appearance: AppearanceSettings;
}

export const DEFAULT_SETTINGS: FocusFlowSettings = {
  schemaVersion: 1,
  setupCompleted: false,
  rootFolder: 'Focus Flow',
  firstWeekday: 1,
  wip: {
    sprintScope: { mode: 'soft', limit: 28 },
    tomorrow: { mode: 'soft', limit: 7 },
    today: { mode: 'soft', limit: 7 },
    inProgress: { mode: 'soft', limit: 1 },
  },
  templates: {
    candidate: 'Focus Flow/Templates/Candidate.md',
    task: 'Focus Flow/Templates/Task.md',
    retrospective: 'Focus Flow/Templates/Retrospective.md',
  },
  appearance: {
    accent: { source: 'obsidian' },
  },
};

const WIP_MODES = new Set<WipEnforcement>(['off', 'soft', 'hard']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : fallback;
}

function isWipMode(value: unknown): value is WipEnforcement {
  return typeof value === 'string' && WIP_MODES.has(value as WipEnforcement);
}

function isWeekday(
  value: unknown,
): value is FocusFlowSettings['firstWeekday'] {
  return (
    Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6
  );
}

function normalizePolicy(
  value: unknown,
  fallback: WipPolicySettings,
): WipPolicySettings {
  const policy = isRecord(value) ? value : {};
  const mode = isWipMode(policy.mode) ? policy.mode : fallback.mode;
  const limit =
    Number.isInteger(policy.limit) && (policy.limit as number) > 0
      ? (policy.limit as number)
      : fallback.limit;

  return { mode, limit };
}

function normalizeAccent(value: unknown): AccentPreference {
  if (!isRecord(value)) return DEFAULT_SETTINGS.appearance.accent;
  if (value.source === 'obsidian' || value.source === 'indigo') {
    return { source: value.source };
  }
  if (value.source !== 'custom' || typeof value.seed !== 'string') {
    return DEFAULT_SETTINGS.appearance.accent;
  }
  const seed = value.seed.toUpperCase();
  return /^#[0-9A-F]{6}$/.test(seed)
    ? { source: 'custom', seed }
    : DEFAULT_SETTINGS.appearance.accent;
}

export function normalizeSettings(input: unknown): FocusFlowSettings {
  const settings = isRecord(input) ? input : {};
  const wip = isRecord(settings.wip) ? settings.wip : {};
  const templates = isRecord(settings.templates) ? settings.templates : {};
  const appearance = isRecord(settings.appearance) ? settings.appearance : {};
  const firstWeekday = settings.firstWeekday;

  return {
    schemaVersion: 1,
    setupCompleted: settings.setupCompleted === true,
    rootFolder: nonEmptyString(
      settings.rootFolder,
      DEFAULT_SETTINGS.rootFolder,
    ),
    firstWeekday: isWeekday(firstWeekday)
      ? firstWeekday
      : DEFAULT_SETTINGS.firstWeekday,
    wip: {
      sprintScope: normalizePolicy(
        wip.sprintScope,
        DEFAULT_SETTINGS.wip.sprintScope,
      ),
      tomorrow: normalizePolicy(wip.tomorrow, DEFAULT_SETTINGS.wip.tomorrow),
      today: normalizePolicy(wip.today, DEFAULT_SETTINGS.wip.today),
      inProgress: normalizePolicy(
        wip.inProgress,
        DEFAULT_SETTINGS.wip.inProgress,
      ),
    },
    templates: {
      candidate: nonEmptyString(
        templates.candidate,
        DEFAULT_SETTINGS.templates.candidate,
      ),
      task: nonEmptyString(templates.task, DEFAULT_SETTINGS.templates.task),
      retrospective: nonEmptyString(
        templates.retrospective,
        DEFAULT_SETTINGS.templates.retrospective,
      ),
    },
    appearance: {
      accent: normalizeAccent(appearance.accent),
    },
  };
}
