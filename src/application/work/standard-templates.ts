export const STANDARD_BODY_TEMPLATES = {
  candidate: `## Description

## Entry Review

## Acceptance Criteria
`,
  epic: `## Intent

## Acceptance Criteria
`,
  story: `## Description

## Acceptance Criteria
`,
  task: `## Description

## Acceptance Criteria
`,
  retrospective: `## Wins

## Friction

## Improvements
`,
} as const;

export type StandardTemplateKind = keyof typeof STANDARD_BODY_TEMPLATES;
