import type { RepairPlan } from '../../domain/work-note';
import type { KeyRepairService } from './repair-keys';
import type { IdRepairService } from './repair-ids';
import type { NotePlacementRepairService } from './repair-note-placement';
import type { ParentLinkRepairService } from './repair-parent-link';
import type { RankRepairService } from './repair-ranks';
import type { CatalogTagRepairService } from './repair-catalog-tag';

export class DiagnosticRepairService {
  constructor(private readonly services: {
    parentLinks: Pick<ParentLinkRepairService, 'execute'>;
    ranks: Pick<RankRepairService, 'execute'>;
    placements: Pick<NotePlacementRepairService, 'execute'>;
    keys: Pick<KeyRepairService, 'execute'>;
    ids: Pick<IdRepairService, 'execute'>;
    tagCatalog?: Pick<CatalogTagRepairService, 'execute'>;
  }) {}

  execute(plan: RepairPlan): Promise<void> {
    if (plan.kind === 'replace-parent-link') {
      return this.services.parentLinks.execute(plan);
    }
    if (plan.kind === 'rebalance-ranks') {
      return this.services.ranks.execute(plan);
    }
    if (plan.kind === 'move-note') {
      return this.services.placements.execute(plan);
    }
    if (plan.kind === 'repair-duplicate-keys') {
      return this.services.keys.execute(plan);
    }
    if (plan.kind === 'repair-duplicate-ids') {
      return this.services.ids.execute(plan);
    }
    if (this.services.tagCatalog === undefined) return Promise.reject(new Error('Tag Catalog repair is unavailable.'));
    return this.services.tagCatalog.execute(plan);
  }
}
