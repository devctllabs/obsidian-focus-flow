import { describe, expect, it, vi } from 'vitest';
import {
  AppearanceStore,
  customAccentPalettes,
  contrastRatio,
} from './appearance';

describe('AppearanceStore', () => {
  it('broadcasts preview, rolls it back, and commits only after persistence succeeds', async () => {
    const save = vi.fn(async () => undefined);
    const store = new AppearanceStore({ source: 'obsidian' }, save);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.preview({ source: 'custom', seed: '#0F766E' });
    expect(store.getSnapshot()).toEqual({ source: 'custom', seed: '#0F766E' });
    expect(listener).toHaveBeenCalledTimes(1);

    store.cancelPreview();
    expect(store.getSnapshot()).toEqual({ source: 'obsidian' });

    store.preview({ source: 'indigo' });
    await store.commit({ source: 'indigo' });
    expect(save).toHaveBeenCalledWith({ source: 'indigo' });
    expect(store.getSnapshot()).toEqual({ source: 'indigo' });

    unsubscribe();
    store.preview({ source: 'obsidian' });
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('keeps a failed draft visible until the user cancels it', async () => {
    const store = new AppearanceStore(
      { source: 'obsidian' },
      async () => { throw new Error('disk full'); },
    );
    store.preview({ source: 'indigo' });

    await expect(store.commit({ source: 'indigo' })).rejects.toThrow('disk full');
    expect(store.getSnapshot()).toEqual({ source: 'indigo' });

    store.cancelPreview();
    expect(store.getSnapshot()).toEqual({ source: 'obsidian' });
  });

  it('adapts one custom seed into readable light and dark role palettes', () => {
    const palettes = customAccentPalettes('#F5D90A');

    expect(palettes.light.text).not.toBe(palettes.dark.text);
    expect(palettes.light.text).not.toBe('#5B5BD6');
    expect(contrastRatio(palettes.light.text, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palettes.light.solid, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(palettes.light.onSolid, palettes.light.solid)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palettes.dark.text, '#17191E')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palettes.dark.solid, '#17191E')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(palettes.dark.onSolid, palettes.dark.solid)).toBeGreaterThanOrEqual(4.5);
  });
});
