export type WorkBodyHeading = 'Description' | 'Intent' | 'Entry Review' | 'Acceptance Criteria';
export type WorkBodyFields = Partial<Record<WorkBodyHeading, string>>;

export function sameBodyFields(left: WorkBodyFields = {}, right: WorkBodyFields = {}): boolean {
  return (['Description', 'Intent', 'Entry Review', 'Acceptance Criteria'] as const).every((heading) => (left[heading] ?? '') === (right[heading] ?? ''));
}

export function readBodyFields(body: string, includeCriteria = true): WorkBodyFields {
  const lines = body.split(/\r?\n/);
  const fields: WorkBodyFields = {};
  for (const title of ['Description', 'Intent', 'Entry Review', 'Acceptance Criteria'] as const) {
    if (title === 'Acceptance Criteria' && !includeCriteria) continue;
    const matches = findMarkdownHeadings(lines, title);
    const heading = matches[0];
    if (heading) fields[title] = lines.slice(heading.index + 1, sectionEnd(lines, heading.index, heading.level)).join('\n').trim();
  }
  return fields;
}

export function writeBodyFields(body: string, fields: WorkBodyFields): string {
  if (Object.keys(fields).length === 0) return body;
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  for (const [title, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const lines = body.split(/\r?\n/);
    const matches = findMarkdownHeadings(lines, title);
    if (matches.length > 1) throw new Error(`Multiple ${title} sections. Resolve them in the note before editing.`);
    const heading = matches[0];
    const normalized = value.trim().replace(/\r?\n/g, eol);
    if (!heading) {
      if (normalized) body = `${body.trimEnd()}${eol}${eol}## ${title}${eol}${eol}${normalized}${eol}`;
      continue;
    }
    const end = sectionEnd(lines, heading.index, heading.level);
    const current = lines.slice(heading.index + 1, end).join('\n').trim();
    if (current === value.trim().replace(/\r\n/g, '\n')) continue;
    body = [...lines.slice(0, heading.index + 1), '', normalized, '', ...lines.slice(end)].join(eol);
  }
  return body;
}
import { findMarkdownHeadings, sectionEnd } from '../../domain/markdown-sections';
