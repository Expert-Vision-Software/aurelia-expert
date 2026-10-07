# ADR-0006: Config keys migrate to OpenCode v2 shapes

Date: 2026-10-07
Status: Accepted (supersedes the v1 key shapes described in ADR-0005; ADR-0005's
installer-owns-consumer-config principle is unchanged)

## Context

OpenCode v2 replaces the v1 config vocabulary: the singular `plugin` key becomes
the `plugins` array (string entries like `name@latest` or `{ package, options }`
objects), and the keyed `permission.skill.<name> = "allow"` record becomes an
ordered `permissions` ruleset of `{ action, resource, effect }` objects where
`skill` permission resources are skill IDs (path-derived directory names) and
matching is wildcard-aware with last-match-wins. The package's installer was
written against the v1 shapes end to end: it read only `config.plugin`, wrote
`config.plugin`, and granted skills through the keyed record.

## Decision

1. The installer writes only v2 shapes: `plugins` array entries canonicalized to
   `aurelia-expert@latest`, and one allow rule per owned skill id appended to the
   `permissions` ruleset (appending preserves the "our skills are allowed"
   guarantee under last-match-wins without reordering consumer rules).
2. Detection reads `plugins` first and falls back read-only to a legacy `plugin`
   entry, so consumers who installed under v1 and then upgraded OpenCode are
   recognized without duplicate registration. The fallback never writes.
3. Uninstall removes our entries from both `plugins` and a legacy `plugin` key
   (dead-key cleanup). Install leaves a legacy key in place — minimal touch.
4. Legacy `permission.skill` records for our skill ids migrate to the ruleset on
   install; records for skills we do not own are never touched. If `permissions`
   exists but is not an array, the permission pass is refused entirely (we cannot
   add v2 grants and strip v1 grants safely in one write).
5. Unparseable configs remain refused byte-for-byte (ADR-0005 behavior). Writes
   stay parse-then-reserialize; a splice-style surgical writer is deferred.
6. The dev self-config (`.opencode/opencode.json`) uses only v2-native keys:
   `plugins: ["opencode-architect@latest"]`. Its `skills: { paths: [...] }` entry
   is dropped: OpenCode v2 natively discovers `.agents/skills` from the working
   directory up to the project root, which is more robust than a CWD-relative
   explicit path. Bundled skill frontmatter is untouched (the skills directory is
   the product and must stay byte-identical).

## Consequences

- Consumers on OpenCode v1 should pin an earlier release of this package; the
  current release targets v2 hosts.
- A consumer registered only in `opencode.jsonc` is invisible to detection until
  JSONC tolerance lands (follow-up).
- `status` reporting of v2-vs-legacy registration representation is deferred.
