# aurelia-expert

This package ships Aurelia v2 expertise to AI coding agents as a bundle of router-routed markdown skills, installable into OpenCode and skill-compatible agents.

## Language

### Skill bundle

**Router**:
The `aurelia-expert` skill. Classifies a prompt into one of seven branches and hands off to a pillar. Holds no Aurelia domain content itself.
_Avoid_: entry point, dispatcher, meta-skill

**Pillar**:
One of the seven peer skills the router hands off to (foundation, runtime, component-library, largespa, migration, plugin, ecosystem). Owns exactly one domain area and never re-routes.
_Avoid_: sub-skill, child skill

**Branch**:
A leading word the router classifies prompts by (branch, scaffold, resolve, slice, lift, assemble, package, wire). Maps one-to-one to a pillar.
_Avoid_: category, trigger

**Leading word**:
The frontmatter dispatch key naming a skill's branch. Appears identically in the description, the body, and every handoff.
_Avoid_: verb, keyword

**Focal pillar**:
The pillar whose structural patterns other pillars defer to for app-organization questions. Only `aurelia-largespa` carries it (`focal-point: true`).
_Avoid_: main pillar, root pillar

**Reference file**:
A per-area deep-dive document linked from a pillar's SKILL.md and listed in its `references` frontmatter.
_Avoid_: sub-doc, guide

**V1 contamination**:
Aurelia 1 API surfacing in a prompt or a drafted answer. Must be lifted through the migration pillar before answering.
_Avoid_: legacy code, v1 leftovers

**Severity level**:
The classification a v1 pattern carries in the removals table: REMOVED, DEPRECATED, or ERROR CODE. Governs how strongly content may speak about the pattern.
_Avoid_: status, category

**Narrow formulation**:
A restriction stated at its true trigger scope rather than as a blanket prohibition.
_Avoid_: blanket rule

**Canonical file**:
The single file allowed to originate a given rule. Every other mention re-states it consistently or points to it.
_Avoid_: source-of-truth file

**Re-statement audit**:
The sweep of all skill bodies and reference files for consistency after a canonical rule changes.
_Avoid_: consistency pass

**Ground truth**:
The authoritative source for a content claim: the `aurelia/aurelia` repository's source, validated directly or via DeepWiki. The public docs site only orients.
_Avoid_: reference docs

### Distribution

**Consumer**:
The project (and its developer) that installs the skill bundle.
_Avoid_: user, client

**Scope**:
An install target: `local` (the consumer project's OpenCode config) or `global` (user-wide).
_Avoid_: level, mode

**Registration**:
The plugin entry listed in a scope's OpenCode config. Read-only to detect; edited only by explicit install.
_Avoid_: installation

**Installation**:
The skill files plus manifest present on disk in a scope.
_Avoid_: registration

**Manifest**:
Per-scope JSON recording the installed version and file hashes. Decides each file's disposition on re-install.
_Avoid_: lockfile

**Consumer-modified file**:
An installed file whose hash drifted from the manifest. Reinstalls skip it unless forced.
_Avoid_: dirty file

**Advisory**:
The one-time not-installed warning emitted at plugin load when no installation exists in any scope.
_Avoid_: notice, banner

**Self config**:
This repo's own dev-only `.opencode/opencode.json`. Never shipped to consumers.
_Avoid_: package config

**Dev-only skill**:
A workspace skill under `.agents/skills` marked `metadata.internal: true`. Invisible to consumers.
_Avoid_: private skill
