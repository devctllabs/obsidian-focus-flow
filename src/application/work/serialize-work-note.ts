import type {
  CandidateCreationPlan,
  TaskCreationPlan,
} from './create-work';

export type WorkCreationPlan = CandidateCreationPlan | TaskCreationPlan;

export function serializeWorkCreationPlan(plan: WorkCreationPlan): string {
  const taskFields =
    plan.kind === 'task'
      ? `  story_id: ${plan.storyId}
  story_link: ${JSON.stringify(plan.storyLink)}
  task_rank: ${plan.taskRank}
  status: todo
  started_at:
  completed_at:
`
      : '';
  return `---
${plan.tags?.length ? `tags: ${JSON.stringify(plan.tags)}\n` : ''}\
focus_flow:
  schema_version: 1
  id: ${plan.id}
  key: ${plan.key}
  type: ${plan.kind}
  lifecycle: ${plan.kind === 'candidate' ? 'inbox' : 'active'}
${taskFields}  created_at: ${JSON.stringify(plan.createdAt)}
---

${plan.body}`;
}
