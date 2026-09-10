import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import { CatalogTagRepairService } from './repair-catalog-tag';

const currentCandidate = {
  id: 'candidate', key: 'FF-1', title: 'Candidate', type: 'candidate' as const, lifecycle: 'inbox' as const,
  createdAt: '2026-09-07T00:00:00Z', tags: ['direct'], effectiveTags: ['direct'], path: 'Inbox/FF-1.md',
};

describe('CatalogTagRepairService', () => {
  it('refreshes both sources and catalogs a still-used exact tag', async () => {
    const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [currentCandidate], diagnostics: [] };
    const index = { refresh: vi.fn().mockResolvedValue(undefined), getSnapshot: () => snapshot };
    let entries: Record<string, object> = {};
    const catalog = { refresh: vi.fn().mockResolvedValue(undefined), getSnapshot: () => ({ entries, diagnostics: [] }), upsert: vi.fn(async (tag: string) => { entries = { ...entries, [tag]: {} }; }) };

    await new CatalogTagRepairService(index, catalog).execute({ kind: 'catalog-tag', tag: 'direct' });

    expect(index.refresh).toHaveBeenCalledOnce();
    expect(catalog.refresh).toHaveBeenCalledOnce();
    expect(catalog.upsert).toHaveBeenCalledWith('direct');
  });

  it('does not write when the stale tag is no longer used', async () => {
    const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [], diagnostics: [] };
    const catalog = { refresh: vi.fn(), getSnapshot: () => ({ entries: {}, diagnostics: [] }), upsert: vi.fn() };

    await new CatalogTagRepairService({ refresh: vi.fn(), getSnapshot: () => snapshot }, catalog).execute({ kind: 'catalog-tag', tag: 'stale' });

    expect(catalog.upsert).not.toHaveBeenCalled();
  });
});
