---
status: accepted
date: 2026-09-02
---

# Keep the Obsidian plugin local-only

The Obsidian plugin has no account, server, network client, telemetry, advertising, or AI runtime. It reads and writes through public Obsidian vault APIs and remains mobile-compatible. Future AI or service integrations run outside the plugin through an explicit CLI/skill boundary, preserving a useful offline product and a small trust surface.

## Considered options

- **Opt-in network features in the plugin** would still add credentials, consent, failure modes, disclosure, and mobile behavior to the trusted runtime.
- **Desktop-only integrations** would split the workflow and violate the first-class mobile boundary.

## Consequences

The plugin cannot depend on remote availability or hide durable state outside the vault. A future proposal to add network or AI behavior to the plugin requires a superseding ADR, not an ordinary feature flag.
