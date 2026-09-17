# focus-flow scenarios

## Create and author a Candidate

### Request

Use `$focus-flow` to create Candidate “Reduce release friction”. Set its Description to “Capture
the recurring problems in the release process.” and apply the Cataloged Tag `area/release`.

### Setup

Use a disposable configured Vault with an empty, consistent Workspace, the standard Candidate
template, a Mission, and a valid Tag Catalog containing `area/release`. Make the installed
`focus-flow` CLI and the current `skills/focus-flow/SKILL.md` available to the executor.

### Success criteria

- The executor invokes `focus-flow create candidate --vault <vault> --title "Reduce release
  friction" --json` exactly once and uses its returned path for authoring.
- Exactly one Candidate is created under `Inbox/` with the CLI-produced filename, title, and
  `focus_flow` branch unchanged.
- Its Description has the requested text and its own top-level tags contain exactly
  `area/release`; no lifecycle or managed state is changed directly.
- The executor invokes `focus-flow check --vault <vault> --json` after authoring and reports a
  successful result without diagnostics.

## Create and author a Task after soft WIP confirmation

### Request

Use `$focus-flow` to create Task “Verify the release bundle” under Story `FF-12`. Set its
Description to “Compare the packaged CLI with the current release.” and apply the Cataloged Tag
`verification`. If Focus Flow asks before exceeding the soft Sprint Scope limit, ask me for
confirmation before continuing.

### Setup

Use a disposable, otherwise consistent Workspace with an Active Sprint containing Story `FF-12`
and a soft Sprint Scope WIP limit already at capacity. Let the Story inherit `product/focus-flow`
from its Epic. Configure a custom Task template with Description, Acceptance Criteria, and a Notes
section containing unrelated text. Provide a valid Tag Catalog containing `product/focus-flow` and
`verification`. Make the installed `focus-flow` CLI and the current
`skills/focus-flow/SKILL.md` available to the executor. The evaluator supplies confirmation only
after the executor requests it.

### Success criteria

- The first `focus-flow create task` invocation omits `--confirm-wip-excess` and creates no Task.
- The executor requests explicit confirmation and, after receiving it, retries exactly once with
  `--confirm-wip-excess`.
- Exactly one Task is created under `FF-12`, and the returned path is used for authoring.
- Its Description contains the requested text, its own top-level tags contain exactly
  `verification`, the inherited `product/focus-flow` tag is not copied, and the custom Notes text
  remains unchanged.
- The CLI-produced filename, title, and `focus_flow` branch remain unchanged; no lifecycle or
  managed state is edited directly.
- The executor invokes `focus-flow check --vault <vault> --json` after authoring and reports only
  the expected soft Sprint Scope warning.
