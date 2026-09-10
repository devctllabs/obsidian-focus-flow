# Focus Flow authoring reference

Use the Workspace's language and existing level of detail. Ask only for information needed to distinguish direction, outcome, and action or to make completion observable.

## Work levels and body sections

| Type | Intended scale | Canonical authoring |
| --- | --- | --- |
| Candidate | An uncommitted idea, request, or intention | Put context in `Description`. Add `Entry Review` only when the user asks to decide. Add Acceptance Criteria only when useful while shaping the idea. |
| Epic | A continuing strategic direction | State the direction and boundary in `Intent`. Acceptance Criteria describe observable exit conditions, not a schedule. |
| Story | One observable weekly-scale outcome under exactly one Epic | Use `Description` for context and constraints. Author at least one observable Acceptance Criterion before treating the Story as ready. |
| Task | One concrete action under exactly one Story that fits within a day or less | Use `Description` for execution context. Add Acceptance Criteria only when performing the action does not make completion obvious. |

Write criteria as Markdown task-list items. Preserve the order and checked state of unchanged criteria. Prefer the smallest set that makes the result testable; do not turn implementation steps into Story or Epic criteria.

Challenge a requested level when its wording conflicts with the model. A result such as “publish a usable summary” is a Story; activities such as “read the chapter” and “edit the summary” are Tasks. An ongoing direction such as “build practical expertise” is an Epic.

When preparing a Candidate for later Epic acceptance, write its proposed intent in `Description`; the plugin offers that text as `Intent` during acceptance. When preparing one for Story acceptance, shape `Description` and Acceptance Criteria for the target weekly outcome. Preserve `Entry Review` through either transition.

## Entry Review

Entry Review supports judgment and never acts as an approval gate. Read `MISSION.md` when present; a missing or empty Mission is context, not a blocker.

Use concise structured bullets:

```markdown
- **WANT:** What result is genuinely wanted?
- **SHOULD:** What pressure or obligation is present, and whose is it?
- **Serves:** Who benefits from the outcome?
- **Mission:** How does it support or compete with the current Mission or another conscious direction?
- **Ownership and timing:** Is it mine to do, and is now the right time?
- **Smallest useful scope:** What smaller commitment would preserve the value?
- **Recommendation:** Accept as Epic, accept as Story under a named Epic, keep as Candidate, or reject as Distraction — with a brief reason.
```

Ask proportional follow-up questions when the evidence cannot support those bullets. Record uncertainty rather than manufacturing alignment. The user performs acceptance or rejection in the plugin.

## Cataloged Tags

`<workspace>/TAGS.md` is the authoring vocabulary. Its body may contain Workspace-specific selection rules; follow them before tag descriptions or name-based inference.

A valid catalog uses exact, case-sensitive keys without a leading `#`:

```yaml
---
focus_flow:
  schema_version: 1
  type: tag_catalog
  tags:
    weekly-review: {}
    area/focus:
      description: Work requiring sustained attention.
      color: "#6750A4"
---
```

Apply only structurally valid entries. An invalid optional description or color does not invalidate an otherwise mapping-shaped entry; a malformed catalog or non-mapping entry is unavailable for automated use.

Tags on an Epic are inherited by its Stories and Tasks; Story tags are inherited by its Tasks. Choose only additional meaning for the child's own `tags`. Existing own tags remain until the user requests removal, even when a different catalog entry appears more suitable.

For a new tag proposed by the skill, show a stable exact name and a short description that distinguishes when it applies before requesting confirmation. A user's explicit request to create a named tag already confirms its name; ask only when the intended meaning is too ambiguous to write the description. Preserve the catalog body and unrelated frontmatter, create or update only `focus_flow.tags.<exact-name>`, and omit color unless the user supplied one.
