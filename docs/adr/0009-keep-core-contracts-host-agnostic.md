---
status: accepted
date: 2026-09-02
---

# Keep core contracts host-agnostic

Domain behavior remains pure TypeScript, application use cases depend on narrow capability contracts, and Obsidian owns adapters, lifecycle, and composition. Serializable view models cross into React. This modest indirection makes structural behavior deterministic and testable now while allowing a future CLI to reuse proven contracts without first extracting them from Obsidian code.

## Considered options

- **Pass Obsidian App or Vault through application code** would reduce small interfaces today but couple every use case and test to the host.
- **Extract packages or a monorepo now** would create distribution and boundary work before a second executable exists.

## Consequences

Host types stop at the adapter boundary, but the repository stays a single package until another executable creates a concrete extraction need. Ports stay capability-sized rather than becoming generic repositories or managers.
