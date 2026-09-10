import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { TagCatalogService } from '../../application/tags/tag-catalog';
import { TagCatalogProvider } from '../ui/TagCatalog';
import { TagChip } from '../ui/Tags';
import { TagCatalogSettings } from './TagCatalogSettings';
import '../../../styles.css';

function catalog(markdown: string | null = null) {
  let content = markdown;
  const service = new TagCatalogService({ read: async () => content, update: async (transform) => { content = transform(content); } });
  return { service, read: () => content };
}

it('edits and clears an optional catalog description without changing its color', async () => {
  const state = catalog('---\nfocus_flow:\n  schema_version: 1\n  type: tag_catalog\n  tags:\n    area/focus:\n      color: "#6750A4"\n---\nProject tag guidance.\n');
  await state.service.refresh();
  const user = userEvent.setup();
  render(<TagCatalogProvider service={state.service}><TagCatalogSettings service={state.service} tags={['area/focus']} /></TagCatalogProvider>);
  await user.click(screen.getByRole('button', { name: 'Tags' }));
  await user.click(screen.getByRole('button', { name: 'Edit #area/focus' }));
  await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Sustained attention');
  await user.click(screen.getByRole('button', { name: 'Save description' }));
  expect(state.read()).toContain('description: Sustained attention');
  expect(state.read()).toContain('color: "#6750A4"');
  expect(state.read()).toContain('Project tag guidance.');
  expect(screen.getByRole('textbox', { name: 'Description' })).toBeVisible();
  await user.clear(screen.getByRole('textbox', { name: 'Description' }));
  await user.click(screen.getByRole('button', { name: 'Save description' }));
  expect(state.read()).not.toContain('description:');
  expect(state.read()).toContain('color: "#6750A4"');
  expect(screen.getByRole('textbox', { name: 'Description' })).toBeVisible();
});

it('catalogs colors live, stays open while editing, returns to a neutral chip, and confirms removal', async () => {
  const state = catalog();
  const user = userEvent.setup();
  render(<TagCatalogProvider service={state.service}><TagCatalogSettings service={state.service} tags={['area/focus']} /><div data-testid="elsewhere"><TagChip tag="area/focus" /></div></TagCatalogProvider>);
  const chip = screen.getByTestId('elsewhere').firstElementChild as HTMLElement;
  await user.click(screen.getByRole('button', { name: 'Tags' }));
  await user.click(screen.getByRole('button', { name: 'Edit #area/focus' }));
  await user.click(screen.getByRole('button', { name: 'Teal' }));
  await waitFor(() => expect(chip.style.getPropertyValue('--ff-tag-color')).toBe('#0F766E'));
  expect(chip).toHaveClass('focus-flow__tag--colored');
  expect(screen.getByRole('textbox', { name: 'Description' })).toBeVisible();
  expect(state.read()).toContain('type: tag_catalog');
  await user.click(screen.getByRole('button', { name: 'Neutral' }));
  await waitFor(() => expect(chip.style.getPropertyValue('--ff-tag-color')).toBe(''));
  expect(chip).not.toHaveClass('focus-flow__tag--colored');
  expect(state.service.getSnapshot().entries['area/focus']).toEqual({});
  expect(screen.getByRole('textbox', { name: 'Description' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'More actions for #area/focus' }));
  await user.click(screen.getByRole('menuitem', { name: 'Remove from catalog…' }));
  expect(screen.getByRole('dialog', { name: 'Remove #area/focus from catalog?' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Remove' }));
  expect(state.service.getSnapshot().entries['area/focus']).toBeUndefined();
});

it('keeps the row tag geometry stable when saving a custom color', async () => {
  const state = catalog();
  const user = userEvent.setup();
  render(<div className="focus-flow"><TagCatalogProvider service={state.service}><TagCatalogSettings service={state.service} tags={['area/focus']} /></TagCatalogProvider></div>);
  await user.click(screen.getByRole('button', { name: 'Tags' }));
  await user.click(screen.getByRole('button', { name: 'Edit #area/focus' }));
  const chip = screen.getByText('#area/focus');
  const before = getComputedStyle(chip);
  const neutralBox = { borderWidth: before.borderTopWidth, padding: before.padding };

  await user.type(screen.getByRole('textbox', { name: 'Custom HEX' }), '#123456');
  await user.click(screen.getByRole('button', { name: 'Save color' }));

  await waitFor(() => expect(chip).toHaveClass('focus-flow__tag--colored'));
  expect(screen.getByText('#area/focus')).toBe(chip);
  const colored = getComputedStyle(chip);
  expect(colored.borderTopWidth).toBe(neutralBox.borderWidth);
  expect(colored.padding).toBe(neutralBox.padding);
});

it('uses the catalog description in the centered host tooltip', async () => {
  const state = catalog('---\nfocus_flow:\n  schema_version: 1\n  type: tag_catalog\n  tags:\n    area/focus:\n      description: Sustained attention\n---\n');
  await state.service.refresh();
  const user = userEvent.setup();
  render(<TagCatalogProvider service={state.service}><TagCatalogSettings service={state.service} tags={['area/focus', 'plain']} /></TagCatalogProvider>);
  await user.click(screen.getByRole('button', { name: 'Tags' }));
  const row = screen.getByRole('button', { name: 'Sustained attention' });
  expect(screen.queryByText('Sustained attention')).not.toBeInTheDocument();
  expect(row).toHaveAttribute('data-tooltip-position', 'top');
  expect(row).toHaveAccessibleDescription('Edit #area/focus');
  await user.click(row);
  expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Sustained attention');
  expect(screen.getByRole('button', { name: 'Edit #plain' })).not.toHaveAttribute('data-tooltip-position');
});

it('adds an observed tag from the row menu and blocks removal while current work uses it', async () => {
  const state = catalog();
  const user = userEvent.setup();
  const { rerender } = render(<TagCatalogProvider service={state.service}><TagCatalogSettings service={state.service} tags={['direct']} currentTagUsage={{ direct: 2 }} /></TagCatalogProvider>);
  await user.click(screen.getByRole('button', { name: 'Tags' }));
  await user.click(screen.getByRole('button', { name: 'Edit #direct' }));
  await user.click(screen.getByRole('button', { name: 'More actions for #direct' }));
  await user.click(screen.getByRole('menuitem', { name: 'Add to catalog' }));
  expect(state.service.getSnapshot().entries.direct).toEqual({});
  expect(screen.getByRole('textbox', { name: 'Description' })).toBeVisible();

  await user.click(screen.getByRole('button', { name: 'More actions for #direct' }));
  await user.click(screen.getByRole('menuitem', { name: 'Remove from catalog…' }));
  expect(screen.getByRole('dialog', { name: 'Remove #direct from current work first' })).toHaveTextContent('2 current notes');
  await user.click(screen.getByRole('button', { name: 'Close dialog' }));
  rerender(<TagCatalogProvider service={state.service}><TagCatalogSettings service={state.service} tags={['direct']} currentTagUsage={{}} /></TagCatalogProvider>);
  expect(screen.getByRole('textbox', { name: 'Description' })).toBeVisible();
});

it('pages and searches all tags, then creates an unused exact catalog entry', async () => {
  const state = catalog();
  const user = userEvent.setup();
  const tags = Array.from({ length: 13 }, (_, index) => `tag-${String(index + 1).padStart(2, '0')}`);
  render(<TagCatalogProvider service={state.service}><TagCatalogSettings service={state.service} tags={tags} /></TagCatalogProvider>);
  const toggle = screen.getByRole('button', { name: 'Tags' });
  expect(toggle).toHaveTextContent('0 cataloged · 0 custom colors');
  await user.click(toggle);
  expect(screen.getAllByRole('button', { name: /^Edit #/ })).toHaveLength(6);
  await user.click(screen.getByRole('button', { name: 'Next tags' }));
  expect(screen.getByText('7–12 of 13 tags')).toBeVisible();
  await user.type(screen.getByRole('searchbox'), 'new/context');
  await user.click(screen.getByRole('button', { name: 'Add #new/context to catalog' }));
  expect(state.service.getSnapshot().entries['new/context']).toEqual({});
});

it('keeps valid entries usable while showing catalog-local diagnostics', async () => {
  const state = catalog('---\nfocus_flow:\n  schema_version: 1\n  type: tag_catalog\n  tags:\n    focus:\n      color: "#6750A4"\n    broken: red\n---\n');
  await state.service.refresh();
  const user = userEvent.setup();
  render(<TagCatalogProvider service={state.service}><TagCatalogSettings service={state.service} tags={[]} /></TagCatalogProvider>);
  expect(screen.getByRole('alert')).toHaveTextContent('#broken');
  await user.click(screen.getByRole('button', { name: 'Tags' }));
  expect(screen.getByRole('button', { name: 'Edit #focus' })).toBeVisible();
});

it('explains an empty catalog after keyboard expansion', async () => {
  const state = catalog();
  const user = userEvent.setup();
  render(<TagCatalogProvider service={state.service}><TagCatalogSettings service={state.service} tags={[]} /></TagCatalogProvider>);
  await user.tab();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('button', { name: 'Tags' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Add a catalog tag or use a tag on work first.')).toBeVisible();
});
