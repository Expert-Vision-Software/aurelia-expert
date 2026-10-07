# OpenCode v2 capability recommendations — aurelia-expert

Companion to the v2 upgrade (issue #3). The bundled facts record was not
available locally; capability pointers cite the upgrade skill's Phase 6 list
and the official v2 docs the port verified against
(`https://opencode.ai/v2/docs/plugins`, `/permissions`, `/skills`, `/config`).

## Adopted in this pass

- **Effect-first plugin API** — `Plugin.define({ id, effect })` with the
  install-on-load work in the effect body; never-throwing startup preserved.
- **v2-native config keys** — installer writes `plugins` + `permissions`
  ruleset; detection dual-reads the legacy singular `plugin` key read-only.
- **`exports["./server"]`** — required for v2 distributed packages; added.
- **`@latest` expression** — dev config pins nothing: `opencode-architect@latest`.

## Recommended v2 capabilities (follow-up work)

| Capability | Verdict | Rationale |
|---|---|---|
| Richer session hooks (per-request-kind context/compaction/generate/title hooks — skill Phase 6, facts §9) | Watch | Not needed today (the plugin registers no hooks); if aurelia-expert ever wants to pre-seed the router skill when an Aurelia project is detected, the v2 context hook is the mechanism. |
| Plugin RPC (`ctx.rpc.register` + optional `./rpc` export — facts §11) | Watch | Could unify the CLI (`install`/`uninstall`/`status`) and the host behind one typed contract; currently the CLI alone owns writes, which is deliberate (ADR-0005). |
| TUI plugins (`./tui` export — facts §11) | Not applicable | No terminal UI surface; the package is markdown skills + an installer. |
| MCP Code Mode (`codemode` on MCP config — facts §8, §10) | Not applicable | The package ships no MCP servers. |
| Saved approvals (`PermissionSaved.Info`, `Request.save` — facts §4) | Adopt later, promising | The installer writes skill allow rules to config files today; persisted approvals could give first-run users a smoother grant flow than file writes, reducing installer config churn. |

## Follow-ups surfaced by the port (not v2 capabilities per se)

1. **JSONC tolerance in detection/read** — a consumer registered only in
   `opencode.jsonc` is invisible to detection and would be re-registered as a
   duplicate; needs a comment-aware parser.
2. **Surgical (splice-style) config writer** — parse-then-reserialize reorders
   consumer formatting; a splice writer would preserve bytes around our keys.
3. **Install-time dead-key pruning** — uninstall already cleans legacy
   `plugin`; install could optionally migrate `plugin` → `plugins` in place.
4. **Status reporting** — show v2-vs-legacy registration representation.
5. **Real-host smoke test** — run `opencode plugin add` + `plugin check`
   against a packaged build in CI.
