---
name: focus-flow
description: Author or revise Candidate, Epic, Story, and Task bodies and Cataloged Tags in a Focus Flow Workspace, run Entry Reviews, create Candidates or Tasks through the focus-flow CLI, or check Workspace consistency. Use only for Focus Flow work notes; lifecycle, status, Sprint, and repair actions stay in the Obsidian plugin.
---

# Focus Flow authoring

Keep structural state behind the `focus-flow` CLI and the Obsidian plugin. Direct Markdown edits may change only the user-owned body and the top-level native `tags` property.

Read [references/authoring.md](references/authoring.md) before composing or revising work, running an Entry Review, or choosing or creating tags. A check-only request does not need the reference.

## Establish the operation

1. Treat an explicit request to create or edit as authorization for that operation. A request for a draft, review, or suggestion remains read-only.
2. Resolve the Obsidian vault root from the user's path or the current working tree. A mutating operation requires `.obsidian/plugins/focus-flow/data.json` and an available `focus-flow` executable; otherwise provide a draft and state the missing prerequisite.
3. Address existing work by its exact `FF-n` key. Locate exactly one canonical note beneath the configured Workspace root; stop on zero or multiple matches.
4. Read the target and only the context that informs it: an Epic for its Story, the Story and Epic for a Task, `MISSION.md` for an Entry Review, and `TAGS.md` when tags may change.

The operation is ready when its target, permitted fields, relevant context, and mutation authority are unambiguous.

## Create work

- Create a Candidate with `focus-flow create candidate --vault <vault> --title <title> --json`.
- Create a Task with `focus-flow create task --vault <vault> --story <FF-n> --title <title> --json`.
- For a requested Epic or Story, create and author a Candidate, then tell the user which explicit acceptance action to take in the plugin. For a Story, name the parent Epic they should select. Never perform the transition in Markdown.
- If Task creation reports a soft WIP excess, request confirmation before one retry with `--confirm-wip-excess`. Treat a hard limit as final.

After successful CLI creation, use the returned vault-relative path for body and tag authoring. If later authoring fails, keep the created note and report the partial result.

## Edit authoring content

- Preserve the `focus_flow` frontmatter branch byte-for-byte. Preserve the filename and title; direct renaming belongs to the plugin.
- Patch only requested canonical body sections and top-level `tags`. Preserve custom sections, unrelated frontmatter, line endings, and checked state for criteria whose meaning did not change.
- Edit a terminal canonical note only when the user explicitly identifies it and asks for that edit.
- On every create or edit, add only clearly relevant valid Cataloged Tags. Keep existing tags unless the user requests their removal, and omit a child tag already inherited through Effective Tags.
- When no Cataloged Tag fits, leave tags unchanged. You may propose one exact tag and description; write it only after confirmation. An explicit request to create that tag is confirmation. Add the catalog entry before applying it to work, and add a color only when requested.
- If `TAGS.md` is malformed, continue an otherwise safe body edit with tags unchanged and report the catalog problem.

Re-read the changed files before verification. The edit is complete only when every changed line belongs to the authorized body sections, top-level tags, or confirmed Tag Catalog entry.

## Verify and report

Run `focus-flow check --vault <vault> --json` after every mutation. For a diagnostic caused by the changed body or tags, make at most one corrective authoring edit and run the check once more. Report managed-data, lifecycle, repair, and unrelated diagnostics without changing them or rolling work back.

Return the affected key and path, the body sections and tags changed, any manual plugin action still required, and the final check result.
