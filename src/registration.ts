import { join } from "node:path";
import {
  getGlobalConfigPath,
  getLocalConfigPath,
  getPackageName,
  isScopeInstalled,
  pluginRegistrationForBase,
  type PluginRegistration,
  type Scope,
} from "./installer.ts";

export type RegistrationContext = "none" | "unknown" | "global" | "repo-local" | "both";

export class RegistrationDetector {
  static async detect(directory: string): Promise<RegistrationContext> {
    const packageName: string = await getPackageName();
    const globalRegistration: PluginRegistration = await pluginRegistrationForBase(
      getGlobalConfigPath(),
      packageName,
    );
    if (globalRegistration === "unknown") {
      return "unknown";
    }
    const repoRegistration: PluginRegistration = await RegistrationDetector.repoRegistration(
      directory,
      packageName,
    );
    if (repoRegistration === "unknown") {
      return "unknown";
    }
    const globalRegistered: boolean = globalRegistration === "registered";
    const repoLocalRegistered: boolean = repoRegistration === "registered";
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

  private static async repoRegistration(directory: string, packageName: string): Promise<PluginRegistration> {
    const nestedRegistration: PluginRegistration = await pluginRegistrationForBase(
      getLocalConfigPath(directory),
      packageName,
    );
    if (nestedRegistration === "unknown") {
      return "unknown";
    }
    if (nestedRegistration === "registered") {
      return "registered";
    }
    const rootRegistration: PluginRegistration = await pluginRegistrationForBase(directory, packageName);
    if (rootRegistration === "unknown") {
      return "unknown";
    }
    if (rootRegistration === "registered") {
      return "registered";
    }
    return "unregistered";
  }
}
