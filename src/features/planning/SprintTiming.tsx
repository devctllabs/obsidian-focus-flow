import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import { useEffect, useState } from 'react';
export function SprintTiming({ sprint }: { sprint: Extract<ProjectedManagedEntity, { type: 'sprint'; lifecycle: 'active' }> }) {
  const started = new Date(sprint.startedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  const days = Math.max(0, Math.floor((now - started.getTime()) / 86_400_000));
  const label = days === 0 ? 'Started today' : `Open ${days} ${days === 1 ? 'day' : 'days'}`;
  return <span className="focus-flow__sprint-dates" title={`Started ${started.toLocaleDateString()} · Planned week ${sprint.startsOn} – ${sprint.dueOn}. Stays open until you close it.`}>{label}</span>;
}
