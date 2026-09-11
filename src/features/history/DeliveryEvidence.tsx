import type { SprintReview } from '../../application/history/review-history';
import { ChevronIcon } from '../ui/Icons';
import { CompactTags } from '../ui/Tags';

export function DeliveryEvidence({ snapshot }: { snapshot: SprintReview['sprint']['closeSnapshot'] }) {
  const summary = snapshot.summary;
  return <details className="focus-flow__delivery-evidence"><summary>Delivery evidence <ChevronIcon /></summary>
    <dl className="focus-flow__delivery-totals"><div><dt>Committed open</dt><dd>{summary.committedOpenTasks}</dd></div><div><dt>Completed</dt><dd>{summary.completedDuringSprint}</dd></div><div><dt>Open at close</dt><dd>{summary.openAtClose}</dd></div></dl>
    <table className="focus-flow__evidence-table"><caption>Scope movement</caption><thead><tr><th scope="col">Work</th><th scope="col">Start</th><th scope="col">Added</th><th scope="col">Removed</th><th scope="col">Close</th></tr></thead><tbody>
      <tr><th scope="row">Stories</th><td>{summary.storiesAtStart}</td><td>{summary.storiesAdded}</td><td>{summary.storiesRemoved}</td><td>{summary.storiesAtClose}</td></tr>
      <tr><th scope="row">Tasks</th><td>{summary.tasksAtStart}</td><td>{summary.tasksAdded}</td><td>{summary.tasksRemoved}</td><td>{summary.tasksAtClose}</td></tr>
    </tbody></table>
    {snapshot.effectiveTagSummary.length === 0 ? <p className="focus-flow__report-caption">No completed Task tags.</p> : <ul className="focus-flow__evidence-tags" aria-label="Frozen Effective Tags">{snapshot.effectiveTagSummary.map((entry) => <li key={entry.tag}><span>{entry.tag}</span><strong>{entry.completedTasks}</strong></li>)}</ul>}
    {snapshot.tasks.length > 0 && <details className="focus-flow__evidence-task-details"><summary>Tasks at close <span>{snapshot.tasks.length}</span></summary><ul>{snapshot.tasks.map((task) => <li key={task.id}><span>{task.key} {task.title}</span><CompactTags tags={task.effectiveTags} /><small>{task.resolution}</small></li>)}</ul></details>}
  </details>;
}
