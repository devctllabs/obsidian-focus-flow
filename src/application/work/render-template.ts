import type { TemplateVariables } from './create-work';

export function renderWorkTemplate(
  template: string,
  variables: TemplateVariables,
): string {
  const values: Record<string, string> = {
    title: variables.title,
    key: variables.key,
    date: variables.date,
    parent_link: variables.parentLink,
  };
  return template.replace(
    /\{\{(title|key|date|parent_link)\}\}/g,
    (_, name: string) => values[name] ?? '',
  );
}
