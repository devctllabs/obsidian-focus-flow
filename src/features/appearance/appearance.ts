import type { AccentPreference } from '../../settings';

export type { AccentPreference } from '../../settings';
export {
  contrastRatio,
  customAccentPalettes,
} from './accent-palette';

export interface AppearanceController {
  getSnapshot(this: void): AccentPreference;
  subscribe(this: void, listener: () => void): () => void;
  preview(this: void, preference: AccentPreference): void;
  cancelPreview(this: void): void;
  commit(this: void, preference: AccentPreference): Promise<void>;
}

export const DEFAULT_ACCENT_PREFERENCE: AccentPreference = {
  source: 'obsidian',
};

export const CLASSIC_INDIGO = {
  light: '#5B5BD6',
  dark: '#9898FF',
} as const;

export function isHexColor(value: string): boolean {
  return /^#[0-9A-F]{6}$/.test(value);
}

export class AppearanceStore implements AppearanceController {
  private previewed: AccentPreference | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private committed: AccentPreference,
    private readonly save: (preference: AccentPreference) => Promise<void>,
  ) {}

  getSnapshot = (): AccentPreference => this.previewed ?? this.committed;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  preview(preference: AccentPreference): void {
    this.previewed = preference;
    this.emit();
  }

  cancelPreview(): void {
    if (this.previewed === null) return;
    this.previewed = null;
    this.emit();
  }

  async commit(preference: AccentPreference): Promise<void> {
    await this.save(preference);
    this.committed = preference;
    this.previewed = null;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
