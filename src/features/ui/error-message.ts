const MAX_ERROR_MESSAGE_LENGTH = 300;
const ABSOLUTE_PATH_PATTERN = /(^|[\s("'`])((?:\/|~\/|[A-Za-z]:[\\/]|\\\\)[^\s"'`<>]*)/g;

const RECOVERY_MESSAGES: Record<string, string> = {
  'Parent Epic was not found.': 'The parent Epic is missing or no longer active. Choose an active Epic and try again.',
  'Story requires an active Epic parent.': 'The parent Epic is no longer active. Choose an active Epic for this Story.',
  'Exactly one Active Sprint is required.': 'This action needs one Active Sprint. Open Plan to start a draft, or fix multiple open Sprints in the Attention center.',
  'Exactly one Draft Sprint is required.': 'This action needs one Draft Sprint. Open Plan to create a draft, or fix multiple open Sprints in the Attention center.',
  'Story requires Acceptance Criteria.': 'Add at least one Acceptance Criterion in the Story editor before adding it to a Sprint.',
  'Every selected Story needs Acceptance Criteria.': 'Add at least one Acceptance Criterion to each selected Story before starting the Sprint.',
  'Sprint scope exceeds the hard limit.': 'This Sprint exceeds its Task limit. Remove Stories from the Sprint or adjust Sprint scope in Settings → Work in progress.',
  'Every unfinished Task needs a close decision.': 'Choose a resolution for each unfinished Task in the Tasks step, then return to Review.',
  'Every Active Sprint Story must be evaluated.': 'Record an outcome for each Story in the Outcomes step, then return to Review.',
  'Unchecked Acceptance Criteria need an exception.': 'Check the met criteria, record an acceptance exception, or choose Not achieved in the Outcomes step.',
  'Every continuing Story needs a Month position.': 'Choose a Month backlog position for each continuing Story in the Outcomes step.',
  'A Draft or Active Sprint already exists.': 'A Sprint is already open. Use its draft in Plan, or review and close the Active Sprint before creating another.',
  'Every child Story must be Done or Closed.': 'Finish or close the remaining Stories before finalizing this Epic. Expand the Epic in Plan to find them.',
  'Complete requires all Epic Acceptance Criteria checked.': 'Open the Epic editor and check all met Acceptance Criteria before marking the Epic complete.',
  'Complete requires at least one child Story.': 'This Epic has no Stories. Add a Story, or use Close Epic if you no longer intend to work on it.',
};

export function formatErrorMessage(error: unknown, fallback: string): string {
  let detail = error instanceof Error ? error.message.replace(/\s+/g, ' ').trim() : '';
  if (detail === '') return fallback;

  if (/\b(EACCES|EPERM)\b/.test(detail)) detail = `${fallback} Check vault access and file permissions, then try again.`;
  else if (/\bENOSPC\b/.test(detail)) detail = `${fallback} Free up storage on this device, then try again.`;
  else if (/\bENOENT\b/.test(detail)) detail = `${fallback} A file or folder is missing. Refresh notes and check the workspace and template paths in Settings.`;
  else if (/^Focus Flow index must be ready/.test(detail)) detail = 'Notes could not be loaded. Use Refresh, then try the action again. Your last loaded view is kept.';
  else detail = RECOVERY_MESSAGES[detail] ?? detail;

  const redacted = detail.replace(ABSOLUTE_PATH_PATTERN, '$1[path redacted]');
  return redacted.length <= MAX_ERROR_MESSAGE_LENGTH
    ? redacted
    : `${redacted.slice(0, MAX_ERROR_MESSAGE_LENGTH - 1).trimEnd()}…`;
}
