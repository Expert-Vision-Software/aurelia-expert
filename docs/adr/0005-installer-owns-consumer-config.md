# The installer owns the consumer's config; the package never self-registers

A plugin writing its own registration at load time would need cross-scope writes and could corrupt consumer configs it cannot parse. We split the work: registration edits and permission allowlisting (`permission.skill[name]="allow"` per bundled skill) happen only via explicit install, performed by the installer CLI. Load-time work is registration-driven — detection is read-only, already-registered scopes get a manifest-gated install, and nothing is written to unregistered scopes. The shipped package contains no config referencing its own skills; this repo's own `.opencode/opencode.json` is dev-only and excluded from the npm payload.

## Consequences

- Consumer-modified files (hash drift from the manifest) are skipped on re-install unless forced, so consumer edits survive upgrades.
- Uninstall must reverse both registration and allowlisting.
- Unparseable consumer configs are preserved untouched, never rewritten.
