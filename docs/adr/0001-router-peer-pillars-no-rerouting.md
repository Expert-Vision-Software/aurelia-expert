# The router hands off to peer pillars and never re-routes

The eight skills could nest or cross-link freely, but dispatch becomes unpredictable when any skill can route to any other, and answers drift across domain areas. We chose a single entry point: the router (`aurelia-expert`) classifies a prompt into one of seven branches, hands off to the named pillar, and stops. Pillars answer only from their own area; overlap between areas is resolved by explicit precedence pairs recorded in the router (migration > largespa for migration-of-large-SPA prompts, migration > component-library for migration-with-library, migration > plugin for packaging-v1-source), never in pillar bodies.

## Consequences

A prompt that spans two areas must be resolvable by the router's precedence rules. If a new overlap emerges, the fix belongs in the router's precedence section, not in a pillar growing a handoff of its own.
