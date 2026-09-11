import { describe, expect, it, vi } from 'vitest';
import { TagCatalogService } from './tag-catalog';

function store(initial: string | null = null) {
  let markdown = initial;
  const update = vi.fn(async (transform: (current: string | null) => string) => { markdown = transform(markdown); });
  return { read: async () => markdown, update, content: () => markdown };
}

describe('TagCatalogService', () => {
  it('catalogs only newly added tags that are not already cataloged', async () => {
    const backing = store('---\nfocus_flow:\n  schema_version: 1\n  type: tag_catalog\n  tags:\n    focus: {}\n---\n');
    const service = new TagCatalogService(backing);
    await service.refresh();

    await service.ensureAdded(['focus', 'observed', 'new/topic'], ['observed']);

    expect(backing.update).toHaveBeenCalledTimes(1);
    expect(backing.content()).toContain('new/topic: {}');
  });

  it('serializes concurrent catalog updates so entries are not lost', async () => {
    const backing = store();
    const service = new TagCatalogService(backing);

    await Promise.all([service.upsert('first'), service.upsert('second', { description: 'Second tag' })]);

    expect(service.getSnapshot().entries).toEqual({ first: {}, second: { description: 'Second tag' } });
  });

});
