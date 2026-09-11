import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppearanceRoot } from './AppearanceRoot';
import { AppearanceStore } from './appearance';

describe('AppearanceRoot', () => {
  it('reacts to a shared custom preview and restores the committed source', () => {
    const store = new AppearanceStore({ source: 'obsidian' }, vi.fn(async () => undefined));
    const { container, unmount } = render(
      <AppearanceRoot appearance={store} className="focus-flow" element="main">
        Content
      </AppearanceRoot>,
    );
    const root = container.querySelector('main')!;
    expect(root).toHaveAttribute('data-ff-accent', 'obsidian');

    act(() => store.preview({ source: 'custom', seed: '#F5D90A' }));
    expect(root).toHaveAttribute('data-ff-accent', 'custom');
    expect(root.style.getPropertyValue('--ff-custom-light-text')).toMatch(/^#[0-9A-F]{6}$/);
    expect(root.style.getPropertyValue('--ff-custom-dark-text')).toMatch(/^#[0-9A-F]{6}$/);

    act(() => store.cancelPreview());
    expect(root).toHaveAttribute('data-ff-accent', 'obsidian');

    unmount();
    expect(() => store.preview({ source: 'indigo' })).not.toThrow();
  });
});
