import { fn } from 'storybook/test';
import { DEFAULT_SETTINGS, type FocusFlowSettings } from '../../settings';
import { AppearanceStore } from '../../features/appearance/appearance';

export function createSettingsController(
  overrides: Partial<FocusFlowSettings> = {},
) {
  let settings: FocusFlowSettings = {
    ...DEFAULT_SETTINGS,
    ...overrides,
    wip: { ...DEFAULT_SETTINGS.wip, ...overrides.wip },
    templates: { ...DEFAULT_SETTINGS.templates, ...overrides.templates },
  };
  const updateSettings = fn(async (update: (current: FocusFlowSettings) => FocusFlowSettings) => {
    settings = update(settings);
  });
  const appearance = new AppearanceStore(settings.appearance.accent, async (accent) => {
    await updateSettings((current) => ({ ...current, appearance: { accent } }));
  });
  return {
    appearance,
    getSettings: () => settings,
    updateSettings,
    requestRootSetup: fn(async (root: string) => {
      settings = { ...settings, rootFolder: root, setupCompleted: true };
    }),
    selectExistingRoot: fn(async (root: string) => {
      settings = { ...settings, rootFolder: root, setupCompleted: true };
    }),
    requestRootMove: fn(async (root: string) => {
      settings = { ...settings, rootFolder: root };
    }),
    requestResumeRootMove: fn(async () => undefined),
    hasPendingRootMove: () => false,
    lifecycle: {
      previewArchive: fn(async () => ({ entries: [], diagnostics: [], resuming: false })),
      organize: fn(async () => undefined),
      previewReopen: fn(),
      reopen: fn(),
    },
    listFolders: () => ['Projects', 'Projects/Archive', 'Focus Flow', 'Focus Flow/Templates'],
    listTemplateFiles: () => [settings.templates.candidate, settings.templates.task, settings.templates.retrospective],
  };
}

export function createRejectingSettingsController(message: string, overrides: Partial<FocusFlowSettings> = {}) {
  const controller = createSettingsController({ setupCompleted: true, ...overrides });
  return {
    ...controller,
    updateSettings: fn(async (_update: (settings: FocusFlowSettings) => FocusFlowSettings) => {
      throw new Error(message);
    }),
    requestRootMove: fn(async (_root: string) => {
      throw new Error(message);
    }),
  };
}
