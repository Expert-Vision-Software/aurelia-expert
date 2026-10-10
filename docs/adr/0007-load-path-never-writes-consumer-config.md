# ADR-0007: Load-time installs never write consumer config

Date: 2026-10-10

## Context

The conformance review against the opencode-architect checklist (items B3, B5,
A6; facts §13 row 10) found the load-time install path writing consumer config:
`ensureSkillPermissions` ran on every non-noop load install, legacy
`permission.skill` records were deleted at load, and every config write was a
parse-then-reserialize that reformatted the whole file.

## Decision

1. **Load path performs zero config writes.** Permission-ruleset writes and
   legacy-record migration are gated behind a new `configurePermissions`
   install option: true for explicit CLI installs, false in
   `LOAD_INSTALL_OPTIONS`. ADR-0005's installer-owns-consumer-config principle
   now applies only to explicit CLI installs.
2. **Config edits are byte-preserving text splices.** `plugins`/`permissions`
   mutations anchor into the raw file text (`ConfigSpliceWriter`) and preserve
   every other byte — comments, indentation, key order. When no anchor exists,
   the installer refuses and warns instead of reformatting. Reads tolerate
   comments and trailing commas (`JsoncParser`).
3. **Cache lifecycle is CLI-owned.** This package's npm cache generations are
   pruned only on explicit installs and via `bunx aurelia-expert clear-cache`;
   the load hook instructs and never deletes.

## Consequences

- Consumer configs are never reordered, reformatted, or stripped at load.
- Detection covers `opencode.json` and `opencode.jsonc`, warns once per
  unparseable candidate, and treats a legacy global `config.json` as read-only
  advisory material.
- Whole-file creation (fresh config, root-config migration) remains
  parse-and-serialize by design; the splice writer covers all edits to
  existing files.
