const PACKAGE_NAME: string = "aurelia-expert";

export class ConfigWarnings {
  private static readonly unparseableWarnedPaths: Set<string> = new Set<string>();

  private static legacyConfigJsonAdvised: boolean = false;

  static warnUnparseableOnce(configPath: string): void {
    if (ConfigWarnings.unparseableWarnedPaths.has(configPath)) {
      return;
    }
    ConfigWarnings.unparseableWarnedPaths.add(configPath);
    console.warn(
      `[${PACKAGE_NAME}] Could not parse config file ${configPath}; ` +
        `it was left unchanged and registration detection continued without it.`,
    );
  }

  static warnLegacyConfigJsonOnce(legacyPath: string): void {
    if (ConfigWarnings.legacyConfigJsonAdvised) {
      return;
    }
    ConfigWarnings.legacyConfigJsonAdvised = true;
    console.warn(
      `[${PACKAGE_NAME}] Found legacy global config file ${legacyPath} mentioning this package. ` +
        `OpenCode v2 reads only opencode.json and opencode.jsonc, never config.json. ` +
        `Register the plugin in one of those files instead. The legacy file was left unchanged.`,
    );
  }

  static refusal(configPath: string, reason: string): void {
    console.warn(
      `[${PACKAGE_NAME}] Refusing to write ${configPath}: ${reason} ` +
        `Fix or remove the file, then re-run install. The file was left unchanged.`,
    );
  }
}
