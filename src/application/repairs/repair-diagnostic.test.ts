import { describe, expect, it, vi } from 'vitest';
import type {
  IdRepairPlan,
  KeyRepairPlan,
  MoveNoteRepairPlan,
  ParentLinkRepairPlan,
  RankRepairPlan,
  CatalogTagRepairPlan,
} from '../../domain/work-note';
import { DiagnosticRepairService } from './repair-diagnostic';

const parentLinkPlan: ParentLinkRepairPlan = {
  kind: 'replace-parent-link',
  path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
  parentId: '019946c9-5f97-7196-8483-73469275ff90',
  field: 'epic_link',
  expectedValue: '[[FF-99 Wrong Epic]]',
  replacementValue: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
};

const rankPlan: RankRepairPlan = {
  kind: 'rebalance-ranks',
  collectionLabel: 'the Epic Backlog',
  entries: [],
};

const movePlan: MoveNoteRepairPlan = {
  kind: 'move-note',
  path: 'Focus Flow/Tasks/FF-41 Explore weekly focus.md',
  id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
  targetFolder: 'Inbox',
};

const keyPlan: KeyRepairPlan = {
  kind: 'repair-duplicate-keys',
  entries: [],
  links: [],
};

const idPlan: IdRepairPlan = {
  kind: 'repair-duplicate-ids',
  entries: [],
  references: [],
};

const catalogPlan: CatalogTagRepairPlan = { kind: 'catalog-tag', tag: 'direct' };

describe('DiagnosticRepairService', () => {
  it('dispatches each repair plan to its owning service', async () => {
    const parentLinks = { execute: vi.fn().mockResolvedValue(undefined) };
    const ranks = { execute: vi.fn().mockResolvedValue(undefined) };
    const placements = { execute: vi.fn().mockResolvedValue(undefined) };
    const keys = { execute: vi.fn().mockResolvedValue(undefined) };
    const ids = { execute: vi.fn().mockResolvedValue(undefined) };
    const tagCatalog = { execute: vi.fn().mockResolvedValue(undefined) };
    const service = new DiagnosticRepairService({ parentLinks, ranks, placements, keys, ids, tagCatalog });

    await service.execute(parentLinkPlan);
    await service.execute(rankPlan);
    await service.execute(movePlan);
    await service.execute(keyPlan);
    await service.execute(idPlan);
    await service.execute(catalogPlan);

    expect(parentLinks.execute).toHaveBeenCalledWith(parentLinkPlan);
    expect(ranks.execute).toHaveBeenCalledWith(rankPlan);
    expect(placements.execute).toHaveBeenCalledWith(movePlan);
    expect(keys.execute).toHaveBeenCalledWith(keyPlan);
    expect(ids.execute).toHaveBeenCalledWith(idPlan);
    expect(tagCatalog.execute).toHaveBeenCalledWith(catalogPlan);
  });
});
