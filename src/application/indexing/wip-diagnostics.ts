import type { WipPolicies, WipPolicy } from '../../domain/wip-policy';
import type { WorkNoteDiagnostic } from '../../domain/work-note';
import type { ProjectedManagedEntity, WorkIndexSnapshot } from './work-index';
import { activeSprintScope } from '../planning/sprint-scope';

export function sprintScopeWipDiagnostics(
  snapshot: WorkIndexSnapshot,
  policy: WipPolicy,
): WorkNoteDiagnostic[] {
  if (policy.mode === 'off') return [];
  const scope = activeSprintScope(snapshot);
  return scope === null
    ? []
    : policyDiagnostic('Sprint Scope', scope.count, policy, scope.sprintPath);
}

export function wipDiagnostics(
  snapshot: WorkIndexSnapshot,
  policies: WipPolicies,
): WorkNoteDiagnostic[] {
  const scope = activeSprintScope(snapshot);
  if (scope === null) return [];
  const tasks = snapshot.entities.filter(
    (
      entity,
    ): entity is Extract<ProjectedManagedEntity, { type: 'task' }> =>
      entity.type === 'task' && scope.taskIds.has(entity.id),
  );
  const statusCount = (status: string) =>
    tasks.filter((task) => task.status === status).length;

  return [
    ...policyDiagnostic(
      'Sprint Scope',
      scope.count,
      policies.sprintScope,
      scope.sprintPath,
    ),
    ...policyDiagnostic(
      'Tomorrow',
      statusCount('tomorrow'),
      policies.tomorrow,
      scope.sprintPath,
    ),
    ...policyDiagnostic(
      'Today',
      statusCount('today'),
      policies.today,
      scope.sprintPath,
    ),
    ...policyDiagnostic(
      'In Progress',
      statusCount('in_progress'),
      policies.inProgress,
      scope.sprintPath,
    ),
  ];
}

function policyDiagnostic(
  label: string,
  observed: number,
  policy: WipPolicy,
  path: string,
): WorkNoteDiagnostic[] {
  if (policy.mode === 'off' || observed <= policy.limit) return [];
  const excess = observed - policy.limit;
  return [{
    code: 'wip-limit-exceeded',
    severity: policy.mode === 'soft' ? 'warning' : 'error',
    message: `${label} ${policy.mode} WIP limit exceeded: observed ${observed}, limit ${policy.limit}, excess ${excess}.`,
    path,
  }];
}
