import type { AcceptanceCriterion } from './work-note';
import { findMarkdownHeadings, sectionEnd } from './markdown-sections';

function checklistItems(lines: readonly string[]) {
  const items: { start: number; end: number; criterion: AcceptanceCriterion }[] = [];
  for (let index = 0; index < lines.length; index++) {
    const match = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/.exec(lines[index]!);
    if (!match) continue;
    const start = index;
    const indent = match[1]!.length + 2;
    const text = [match[3]!];
    while (index + 1 < lines.length && lines[index + 1]!.startsWith(' '.repeat(indent))) text.push(lines[++index]!.slice(indent));
    items.push({ start, end: index + 1, criterion: { text: text.join('\n').trimEnd(), checked: match[2]!.toLowerCase() === 'x' } });
  }
  return items;
}

export function readAcceptanceCriteria(body: string): AcceptanceCriterion[] {
  const lines = body.split(/\r?\n/);
  const heading = findMarkdownHeadings(lines, 'Acceptance Criteria')[0];
  if (!heading) return [];
  return checklistItems(lines.slice(heading.index + 1, sectionEnd(lines, heading.index, heading.level))).map((item) => item.criterion);
}

export function replaceAcceptanceCriteria(body: string, criteria: readonly AcceptanceCriterion[]): string {
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  const lines = body.split(/\r?\n/);
  const matches = findMarkdownHeadings(lines, 'Acceptance Criteria');
  if (matches.length > 1) throw new Error('Multiple Acceptance Criteria sections. Resolve them in the note before editing.');
  const heading = matches[0];
  const replacements = criteria.map((criterion) => `- [${criterion.checked ? 'x' : ' '}] ${criterion.text.replace(/\r?\n/g, `${eol}  `)}`);
  if (!heading) return `${body.trimEnd()}${eol}${eol}## Acceptance Criteria${eol}${eol}${replacements.join(eol)}${eol}`;
  const end = sectionEnd(lines, heading.index, heading.level);
  const section = lines.slice(heading.index + 1, end);
  const items = checklistItems(section);
  const updated: string[] = [];
  let cursor = 0;
  items.forEach((item, index) => {
    updated.push(...section.slice(cursor, item.start));
    if (replacements[index] !== undefined) updated.push(replacements[index]);
    cursor = item.end;
  });
  updated.push(...replacements.slice(items.length), ...section.slice(cursor));
  return [...lines.slice(0, heading.index + 1), ...updated, ...lines.slice(end)].join(eol);
}
