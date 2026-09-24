# Focus Flow

Focus Flow is an Obsidian plugin for running a personal work-management system
from Markdown notes. It connects an idea inbox to Epic and Story backlogs, a
weekly Story-swimlane board, explicit Sprint closure, and human-readable
history.

## Install

Install Focus Flow through [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install and enable **BRAT** from Obsidian's Community plugins.
2. Run **BRAT: Add a beta plugin for testing** from the command palette.
3. Enter `https://github.com/devctllabs/obsidian-focus-flow`.
4. Enable **Focus Flow** under **Settings → Community plugins**.

See the [user guide](./docs/user-guide.md) for manual installation, setup, and
everyday workflows.

## Product principles

- Markdown in the Active Workspace is the source of truth.
- Focus Flow is permanently personal, with one hierarchy: Epic → Story → Task.
- Backlogs express priority, Stories express outcomes, and weekly commitment is
  explicit rather than rolled over automatically.
- Desktop and mobile are first-class; the plugin stays local-only, with no
  account, network, telemetry, or AI runtime.

## Documentation

- [How Focus Flow works](./docs/framework.md)
- [User guide](./docs/user-guide.md)
- [Product specification](./docs/product-spec.md)
- Technical reference: [domain language](./CONTEXT.md),
  [architecture](./docs/architecture.md),
  [Markdown data model](./docs/data-model.md), and
  [architecture decisions](./docs/adr/)

## Agent skill and CLI

The companion `$focus-flow` skill can author Candidate and Task content through
the deterministic CLI. Lifecycle, status, Sprint, and repair actions stay in
the Obsidian plugin.

With Node.js 22+, npm, and Git installed:

```sh
npm install -g --install-links 'github:devctllabs/obsidian-focus-flow'
focus-flow --version
```

On npm versions that otherwise link a prepared Git checkout to a temporary
directory, `--install-links` keeps the installed CLI independent of that
temporary checkout.

```sh
focus-flow create candidate --vault "/path/to/vault" --title "Capture friction"
focus-flow create task --vault "/path/to/vault" --story FF-7 --title "Verify CLI"
focus-flow check --vault "/path/to/vault" --json
```

The CLI runs locally without network requests and reads the Focus Flow settings
from the supplied Obsidian vault. The optional agent skill remains source-only
under `skills/focus-flow/`; copy that complete directory separately into the
skill directory used by your agent.

## Development

```sh
pnpm install --frozen-lockfile
pnpm check
```

Use `pnpm dev` for a watched plugin bundle, `pnpm storybook` for isolated React
surfaces, `pnpm check:full` for the full gate with real-Obsidian E2E, and
`pnpm build:cli` to build the Node 22 executable.

## License

Focus Flow is licensed under the [MIT License](./LICENSE).
