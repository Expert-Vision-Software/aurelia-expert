export class CopyModeUnsupportedError extends Error {
  constructor() {
    super(
      "Copy mode is not supported for code-backed packages. " +
        "aurelia-expert ships a plugin hook, so it must be registered via the plugin config entry " +
        '(the default behavior). Re-run "bunx aurelia-expert install" without --mode copy; ' +
        "registration writes aurelia-expert@latest into opencode.json and OpenCode manages the cache itself.",
    );
    this.name = "CopyModeUnsupportedError";
  }
}
