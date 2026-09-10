import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActionMenu, MenuAction } from './ActionMenu';
import { DialogSurface } from './DialogSurface';
import { AppearanceProvider } from '../appearance/AppearanceRoot';
import { AppearanceStore } from '../appearance/appearance';

describe('floating surfaces', () => {
  it('keeps an open dialog synchronized with the shared accent preview', () => {
    const appearance = new AppearanceStore({ source: 'obsidian' }, vi.fn(async () => undefined));
    render(<AppearanceProvider appearance={appearance}><DialogSurface title="Decision" onClose={vi.fn()}>Content</DialogSurface></AppearanceProvider>);
    const portal = screen.getByRole('dialog', { name: 'Decision' }).parentElement!;
    expect(portal).toHaveAttribute('data-ff-accent', 'obsidian');

    act(() => appearance.preview({ source: 'custom', seed: '#0F766E' }));
    expect(portal).toHaveAttribute('data-ff-accent', 'custom');
    expect(portal.style.getPropertyValue('--ff-custom-light-text')).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('navigates actions by keyboard and restores the trigger after selection', async () => {
    const user = userEvent.setup();
    const apply = vi.fn();
    render(<ActionMenu label="Actions"><MenuAction>First</MenuAction><MenuAction onClick={apply}>Second</MenuAction></ActionMenu>);
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.keyboard('{ArrowDown}{Enter}');
    expect(apply).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
  });

  it('keeps keyboard focus inside the dialog', async () => {
    const user = userEvent.setup();
    render(<><button>Outside</button><DialogSurface title="Decision" onClose={vi.fn()}><button>Confirm</button></DialogSurface></>);
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
  });
});
