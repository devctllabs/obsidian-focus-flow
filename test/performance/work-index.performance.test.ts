import { performance } from 'node:perf_hooks';
import { describe, expect, it, vi } from 'vitest';
import { WorkIndex } from '../../src/application/indexing/work-index';
import { createOneHundredThousandNoteFixture } from './work-index-fixture';

const MAX_COLD_INDEX_MS = 3_000;
const MAX_WARM_UPDATE_MS = 100;

describe('100,000-note WorkIndex fixture', () => {
  it.each([
    { profile: 'desktop', batchSize: 200, expectedYields: 499 },
    { profile: 'mobile', batchSize: 50, expectedYields: 1_999 },
  ])(
    'indexes without a long uninterrupted parse on $profile',
    async ({ profile, batchSize, expectedYields }) => {
      const sources = createOneHundredThousandNoteFixture();
      const yieldToMain = vi.fn().mockResolvedValue(undefined);
      const repository = {
        list: vi.fn().mockResolvedValue(sources),
        read: vi.fn(async (path: string) => {
          return sources.find((source) => source.path === path) ?? null;
        }),
        readMission: vi.fn().mockResolvedValue({
          path: 'Focus Flow/MISSION.md',
          body: 'Choose deliberately.',
        }),
      };
      const index = new WorkIndex(repository, { batchSize, yieldToMain });

      const coldStartedAt = performance.now();
      await index.refresh();
      const coldMs = performance.now() - coldStartedAt;

      const changedPath = sources[0]?.path;
      if (changedPath === undefined) throw new Error('Fixture is empty.');
      const warmStartedAt = performance.now();
      await index.refreshPaths([changedPath]);
      const warmMs = performance.now() - warmStartedAt;

      expect(index.getSnapshot()).toMatchObject({
        phase: 'ready',
        diagnostics: [],
      });
      expect(index.getSnapshot().entities).toHaveLength(100_000);
      expect(yieldToMain).toHaveBeenCalledTimes(expectedYields);
      expect(repository.list).toHaveBeenCalledTimes(1);
      expect(repository.read).toHaveBeenCalledTimes(1);
      expect(coldMs).toBeLessThan(MAX_COLD_INDEX_MS);
      expect(warmMs).toBeLessThan(MAX_WARM_UPDATE_MS);

      process.stdout.write(
        `${JSON.stringify({ profile, notes: sources.length, coldMs, warmMs, yields: expectedYields })}\n`,
      );
    },
  );
});
