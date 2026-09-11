import type { WorkNoteSource } from '../../src/domain/work-note';

const CREATED_AT = '2026-08-30T08:30:00+04:00';

function uuid(index: number): string {
  return `01990000-0000-7000-8000-${index.toString(16).padStart(12, '0')}`;
}

function rank(index: number): string {
  return `a${index.toString().padStart(5, '0')}`;
}

export function createOneHundredThousandNoteFixture(): WorkNoteSource[] {
  const sources: WorkNoteSource[] = [];
  const epics = Array.from({ length: 1_000 }, (_, index) => {
    const number = index + 1;
    const title = `Outcome ${number}`;
    const path = `Focus Flow/Epics/FF-${number} ${title}.md`;
    sources.push({
      path,
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: uuid(number),
          key: `FF-${number}`,
          type: 'epic',
          lifecycle: 'backlog',
          backlog_rank: rank(number),
          created_at: CREATED_AT,
        },
        tags: [`area/${number % 5}`],
      },
      body: '',
    });
    return { id: uuid(number), path };
  });

  const stories = Array.from({ length: 9_000 }, (_, index) => {
    const number = index + 1_001;
    const epic = epics[index % epics.length];
    if (epic === undefined) throw new Error('Fixture Epic is missing.');
    const title = `Story ${number}`;
    const path = `Focus Flow/Stories/FF-${number} ${title}.md`;
    sources.push({
      path,
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: uuid(number),
          key: `FF-${number}`,
          type: 'story',
          lifecycle: 'backlog',
          epic_id: epic.id,
          epic_link: `[[${epic.path.slice(0, -3)}]]`,
          backlog_rank: rank(number),
          created_at: CREATED_AT,
        },
        tags: [`stream/${index % 9}`],
      },
      body:
        '## Acceptance Criteria\n\n- [ ] Deliver the outcome',
    });
    return { id: uuid(number), path };
  });

  for (let index = 0; index < 90_000; index += 1) {
    const number = index + 10_001;
    const story = stories[index % stories.length];
    if (story === undefined) throw new Error('Fixture Story is missing.');
    const title = `Task ${number}`;
    sources.push({
      path: `Focus Flow/Tasks/FF-${number} ${title}.md`,
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: uuid(number),
          key: `FF-${number}`,
          type: 'task',
          lifecycle: 'active',
          story_id: story.id,
          story_link: `[[${story.path.slice(0, -3)}]]`,
          task_rank: rank(number),
          status: 'todo',
          created_at: CREATED_AT,
        },
        tags: [`context/${index % 7}`],
      },
      body: '',
    });
  }

  return sources;
}
