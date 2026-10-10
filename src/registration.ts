import { exists, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getGlobalConfigPath,
  getLocalConfigPath,
  getPackageName,
  isPluginInConfig,
  isScopeInstalled,
  type Scope,
} from "./installer.ts";
import { ConfigPaths } from "./config-paths.ts";
import { ConfigWarnings } from "./config-warnings.ts";

export type RegistrationContext = "none" | "global" | "repo-local" | "both";

export class RegistrationDetector {
  static async detect(directory: string): Promise<RegistrationContext> {
    const packageName: string = await getPackageName();
    const globalRegistered: boolean = await RegistrationDetector.isRegisteredInBase(
      getGlobalConfigPath(),
      packageName,
    );
    const repoLocalRegistered: boolean = await RegistrationDetector.isRegisteredInRepo(directory, packageName);
    await RegistrationDetector.adviseLegacyGlobalConfig(packageName);

    if (globalRegistered && repoLocalRegistered) {
      return "both";
    }
    if (globalRegistered) {
      return "global";
    }
    if (repoLocalRegistered) {
      return "repo-local";
    }
    return "none";
  }

  static scopesToEnsure(context: RegistrationContext): Scope[] {
    if (context === "both") {
      return ["global", "local"];
    }
    if (context === "global") {
      return ["global"];
    }
    if (context === "repo-local") {
      return ["local"];
    }
    return [];
  }

  static async hasAnyInstallation(directory: string): Promise<boolean> {
    const globalBase: string = getGlobalConfigPath();
    if (await isScopeInstalled(globalBase)) {
      return true;
    }
    return isScopeInstalled(getLocalConfigPath(directory));
  }

  private static async isRegisteredInBase(configBase: string, packageName: string): Promise<boolean> {
    for (const candidate of ConfigPaths.candidates(configBase)) {
      if (await isPluginInConfig(candidate, packageName)) {
        return true;
      }
    }
    return false;
  }

  private static async isRegisteredInRepo(directory: string, packageName: string): Promise<boolean> {
    const nestedBase: string = getLocalConfigPath(directory);
    if (await RegistrationDetector.isRegisteredInBase(nestedBase, packageName)) {
      return true;
    }
    return RegistrationDetector.isRegisteredInBase(directory, packageName);
  }

  private static async adviseLegacyGlobalConfig(packageName: string): Promise<void> {
    try {
      const legacyPath: string = join(getGlobalConfigPath(), "config.json");
      if (!(await exists(legacyPath))) {
        return;
      }
      const content: string = await readFile(legacyPath, "utf-8");
      if (!content.toLowerCase().includes(packageName.toLowerCase())) {
        return;
      }
      ConfigWarnings.warnLegacyConfigJsonOnce(legacyPath);
    } catch {
      return;
    }
  }
}
