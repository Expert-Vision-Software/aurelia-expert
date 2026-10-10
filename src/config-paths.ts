import { join } from "node:path";

export class ConfigPaths {
  static readonly CONFIG_FILE_NAME: string = "opencode.json";

  static readonly CONFIG_JSONC_FILE_NAME: string = "opencode.jsonc";

  static candidates(base: string): string[] {
    return [join(base, ConfigPaths.CONFIG_FILE_NAME), join(base, ConfigPaths.CONFIG_JSONC_FILE_NAME)];
  }

  static writableConfigPath(base: string): string {
    return join(base, ConfigPaths.CONFIG_FILE_NAME);
  }

  static jsoncSiblingOf(configPath: string): string | null {
    if (!configPath.endsWith(ConfigPaths.CONFIG_FILE_NAME)) {
      return null;
    }
    return `${configPath}c`;
  }
}
