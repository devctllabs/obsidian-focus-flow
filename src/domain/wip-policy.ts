export type WipEnforcement = 'off' | 'soft' | 'hard';

export interface WipPolicy {
  mode: WipEnforcement;
  limit: number;
}

export interface WipPolicies {
  sprintScope: WipPolicy;
  tomorrow: WipPolicy;
  today: WipPolicy;
  inProgress: WipPolicy;
}

export type WipDecision =
  | { kind: 'allow' }
  | { kind: 'confirm'; excess: number }
  | { kind: 'reject'; excess: number };

export function evaluateWip(
  policy: WipPolicy,
  proposedCount: number,
): WipDecision {
  if (policy.mode === 'off' || proposedCount <= policy.limit) {
    return { kind: 'allow' };
  }

  const violation = { excess: proposedCount - policy.limit };
  return policy.mode === 'soft'
    ? { kind: 'confirm', ...violation }
    : { kind: 'reject', ...violation };
}

export function sprintScopeCount(
  openAtStart: number,
  added: number,
  removed: number,
): number {
  return openAtStart + added - removed;
}
