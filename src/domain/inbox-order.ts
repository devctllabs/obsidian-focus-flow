import type { WorkEntity } from './work-note';
import { compareOrdinal, compareRank } from './ordering';

interface InboxOrderedCandidate {
  id: string;
  key: string;
  createdAt: string;
  inboxRank?: string | null;
}

export function compareInboxCandidates(left: InboxOrderedCandidate, right: InboxOrderedCandidate): number {
  return compareOptionalRanks(left.inboxRank ?? null, right.inboxRank ?? null, left.id, right.id)
    ?? (Date.parse(left.createdAt) - Date.parse(right.createdAt) || compareOrdinal(left.key, right.key));
}

export function inboxCandidates<T extends WorkEntity | { type: 'sprint' }>(entities: readonly T[]): Extract<T, { type: 'candidate'; lifecycle: 'inbox' }>[] {
  return entities.filter((entity): entity is Extract<T, { type: 'candidate'; lifecycle: 'inbox' }> => entity.type === 'candidate' && entity.lifecycle === 'inbox').sort(compareInboxCandidates);
}

interface OrderedDistraction {
  id: string;
  key: string;
  rejectedAt: string;
  distractionRank?: string | null;
}

export function compareDistractions(left: OrderedDistraction, right: OrderedDistraction): number {
  return compareOptionalRanks(left.distractionRank ?? null, right.distractionRank ?? null, left.id, right.id)
    ?? (Date.parse(right.rejectedAt) - Date.parse(left.rejectedAt) || compareOrdinal(left.key, right.key));
}

export function distractions<T extends WorkEntity | { type: 'sprint' }>(entities: readonly T[]): Extract<T, { type: 'candidate'; lifecycle: 'rejected' }>[] {
  return entities.filter((entity): entity is Extract<T, { type: 'candidate'; lifecycle: 'rejected' }> => entity.type === 'candidate' && entity.lifecycle === 'rejected').sort(compareDistractions);
}

function compareOptionalRanks(left: string | null, right: string | null, leftId: string, rightId: string): number | null {
  if (left !== null && right !== null) return compareRank(left, right, leftId, rightId);
  if (left !== null) return -1;
  if (right !== null) return 1;
  return null;
}
