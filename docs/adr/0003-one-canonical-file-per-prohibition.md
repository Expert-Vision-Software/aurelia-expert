# Every prohibition lives in exactly one canonical file

A DeepWiki validation sweep of the bundle found 25 inconsistent re-statements of the same rules in one pass — including a v1-era error code (AUR0009) stated where the compiler actually emits AUR0713. Rules stated in many places rot in many places. We restricted origination: the migration pillar's v1-removals table is the only place a v1 prohibition may originate, together with its severity level (REMOVED / DEPRECATED / ERROR CODE); the foundation pillar's guardrails are the only "always do" list. All other content re-states canonical rules consistently or points at them.

## Consequences

Changing a canonical rule requires a re-statement audit across all pillars and reference files before release. Content that needs a rule cites the canonical file instead of paraphrasing it into a new severity.
