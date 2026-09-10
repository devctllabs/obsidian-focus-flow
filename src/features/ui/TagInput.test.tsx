import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { TagCatalogService } from '../../application/tags/tag-catalog';
import { TagCatalogProvider } from './TagCatalog';
import { TagInput } from './TagInput';

it('lists cataloged tags first with descriptions, followed by observed tags', async () => {
  const markdown = '---\nfocus_flow:\n  schema_version: 1\n  type: tag_catalog\n  tags:\n    zeta:\n      description: Preferred project tag\n    alpha: {}\n---\n';
  const service = new TagCatalogService({ read: async () => markdown, update: async () => undefined });
  await service.refresh();
  render(<TagCatalogProvider service={service}><TagInput value={[]} onChange={vi.fn()} suggestions={['observed', 'zeta']} /></TagCatalogProvider>);

  await userEvent.click(screen.getByRole('combobox', { name: 'Tags' }));

  const options = screen.getAllByRole('option');
  expect(options.map((option) => option.getAttribute('aria-label'))).toEqual(['#alpha', '#zeta', '#observed']);
  expect(screen.getByText('Preferred project tag')).toBeVisible();
  expect(screen.getByRole('option', { name: '#observed' })).not.toHaveTextContent('Not cataloged');
});
