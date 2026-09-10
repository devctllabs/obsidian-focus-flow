import { generateKeyBetween } from 'fractional-indexing';
import { compareRank } from '../../domain/ordering';
import { sameBodyFields, type WorkBodyFields } from './work-body-fields';

export interface CandidateAcceptanceFields {
  title: string;
  tags: readonly string[];
  bodyFields: WorkBodyFields;
  expected: { title: string; tags: readonly string[]; bodyFields: WorkBodyFields };
}
import type {
  ProjectedManagedEntity,
  WorkIndex,
} from '../indexing/work-index';

export interface AcceptCandidateAsEpicPlan {
  authoring?: CandidateAcceptanceFields;
  kind: 'accept-candidate-as-epic';
  path: string;
  id: string;
  key: string;
  title: string;
  backlogRank: string;
}

export interface AcceptCandidateAsStoryPlan {
  authoring?: CandidateAcceptanceFields;
  kind: 'accept-candidate-as-story';
  path: string;
  id: string;
  key: string;
  title: string;
  epicId: string;
  epicLink: string;
  backlogRank: string | null;
}

export interface RejectCandidatePlan {
  kind: 'reject-candidate';
  path: string;
  id: string;
  key: string;
  title: string;
  rejectedAt: string;
  rejectionReason: string | null;
}

interface ReconsiderCandidatePlan {
  kind: 'reconsider-candidate';
  path: string;
  id: string;
  key: string;
  title: string;
}

export type CandidateTriagePlan =
  | AcceptCandidateAsEpicPlan
  | AcceptCandidateAsStoryPlan
  | RejectCandidatePlan
  | ReconsiderCandidatePlan;

export interface CandidateTriageWriter {
  apply(plan: CandidateTriagePlan): Promise<string>;
}

export class CandidateTriageService {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly writer: CandidateTriageWriter,
    private readonly index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  acceptAsEpic(candidateId: string, authoring?: CandidateAcceptanceFields): Promise<string> {
    return this.enqueue(async () => {
      const snapshot = await this.refreshReadySnapshot();
      const candidate = uniqueInboxCandidate(snapshot.entities, candidateId);
      validateAcceptanceFields(candidate, authoring);
      const epics = snapshot.entities
        .filter(
          (
            entity,
          ): entity is Extract<
            ProjectedManagedEntity,
            { type: 'epic'; lifecycle: 'backlog' }
          > =>
            entity.type === 'epic' && entity.lifecycle === 'backlog',
        )
        .sort(compareByBacklogRank);
      const path = await this.writer.apply({
        kind: 'accept-candidate-as-epic',
        path: candidate.path,
        id: candidate.id,
        key: candidate.key,
        title: authoring?.title.trim() ?? candidate.title,
        ...(authoring ? { authoring } : {}),
        backlogRank: generateKeyBetween(
          epics.at(-1)?.backlogRank ?? null,
          null,
        ),
      });
      await this.index.refresh();
      return path;
    });
  }

  acceptAsStory(candidateId: string, epicId: string, authoring?: CandidateAcceptanceFields): Promise<string> {
    return this.enqueue(async () => {
      const snapshot = await this.refreshReadySnapshot();
      const candidate = uniqueInboxCandidate(snapshot.entities, candidateId);
      validateAcceptanceFields(candidate, authoring);
      const epicMatches = snapshot.entities.filter(
        (entity) =>
          entity.type === 'epic' &&
          entity.lifecycle === 'backlog' &&
          entity.id === epicId,
      );
      const epic = epicMatches.length === 1 ? epicMatches[0] : undefined;
      if (epic?.type !== 'epic') {
        throw new Error('Parent Epic was not found.');
      }
      const path = await this.writer.apply({
        kind: 'accept-candidate-as-story',
        path: candidate.path,
        id: candidate.id,
        key: candidate.key,
        title: authoring?.title.trim() ?? candidate.title,
        ...(authoring ? { authoring } : {}),
        epicId: epic.id,
        epicLink: `[[${epic.path.replace(/\.md$/, '')}]]`,
        backlogRank: null,
      });
      await this.index.refresh();
      return path;
    });
  }

  reject(candidateId: string, reason: string | null): Promise<string> {
    return this.enqueue(async () => {
      const snapshot = await this.refreshReadySnapshot();
      const candidate = uniqueInboxCandidate(snapshot.entities, candidateId);
      const normalizedReason = reason?.trim() || null;
      const path = await this.writer.apply({
        kind: 'reject-candidate',
        path: candidate.path,
        id: candidate.id,
        key: candidate.key,
        title: candidate.title,
        rejectedAt: this.now(),
        rejectionReason: normalizedReason,
      });
      await this.index.refresh();
      return path;
    });
  }

  reconsider(candidateId: string): Promise<string> {
    return this.enqueue(async () => {
      const snapshot = await this.refreshReadySnapshot();
      const candidate = uniqueRejectedCandidate(snapshot.entities, candidateId);
      const path = await this.writer.apply({
        kind: 'reconsider-candidate',
        path: candidate.path,
        id: candidate.id,
        key: candidate.key,
        title: candidate.title,
      });
      await this.index.refresh();
      return path;
    });
  }

  private async refreshReadySnapshot() {
    await this.index.refresh();
    const snapshot = this.index.getSnapshot();
    if (snapshot.phase !== 'ready') {
      throw new Error('Focus Flow index must be ready before triage.');
    }
    return snapshot;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function uniqueRejectedCandidate(
  entities: readonly ProjectedManagedEntity[],
  candidateId: string,
) {
  const matches = entities.filter(
    (
      entity,
    ): entity is Extract<ProjectedManagedEntity, { type: 'candidate'; lifecycle: 'rejected' }> =>
      entity.type === 'candidate' &&
      entity.lifecycle === 'rejected' &&
      entity.id === candidateId,
  );
  if (matches.length !== 1) {
    throw new Error('Rejected Candidate was not found.');
  }
  return matches[0]!;
}

function uniqueInboxCandidate(
  entities: readonly ProjectedManagedEntity[],
  candidateId: string,
) {
  const matches = entities.filter(
    (
      entity,
    ): entity is Extract<ProjectedManagedEntity, { type: 'candidate' }> =>
      entity.type === 'candidate' &&
      entity.lifecycle === 'inbox' &&
      entity.id === candidateId,
  );
  if (matches.length !== 1) {
    throw new Error('Inbox Candidate was not found.');
  }
  return matches[0]!;
}

function compareByBacklogRank(
  left: { backlogRank: string; id: string },
  right: { backlogRank: string; id: string },
): number {
  return compareRank(left.backlogRank, right.backlogRank, left.id, right.id);
}

function validateAcceptanceFields(candidate: Extract<ProjectedManagedEntity, { type: 'candidate' }>, fields?: CandidateAcceptanceFields): void {
  if (!fields) return;
  if (!fields.title.trim()) throw new Error('Title is required.');
  if (candidate.title !== fields.expected.title || JSON.stringify([...candidate.tags].sort()) !== JSON.stringify([...fields.expected.tags].sort()) || !sameBodyFields(candidate.bodyFields, fields.expected.bodyFields)) throw new Error('This Candidate changed. Reopen the form to load its latest fields.');
}
