import type { TagCatalogService } from '../tags/tag-catalog';
import { uncatalogedTagDiagnostics } from '../tags/catalog-diagnostics';
import type { WorkIndex } from '../indexing/work-index';
import type { CatalogTagRepairPlan } from '../../domain/work-note';

export class CatalogTagRepairService {
  constructor(
    private readonly index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>,
    private readonly catalog: Pick<TagCatalogService, 'refresh' | 'getSnapshot' | 'upsert'>,
  ) {}

  async execute(plan: CatalogTagRepairPlan): Promise<void> {
    await Promise.all([this.index.refresh(), this.catalog.refresh()]);
    if (this.catalog.getSnapshot().entries[plan.tag] !== undefined) return;
    const stillMissing = uncatalogedTagDiagnostics(this.index.getSnapshot().entities, this.catalog.getSnapshot())
      .some((diagnostic) => diagnostic.repair?.kind === 'catalog-tag' && diagnostic.repair.tag === plan.tag);
    if (!stillMissing) return;
    await this.catalog.upsert(plan.tag);
    if (this.catalog.getSnapshot().entries[plan.tag] === undefined) throw new Error(`#${plan.tag} is still missing from TAGS.md after the repair.`);
  }
}
