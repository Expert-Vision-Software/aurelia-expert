import type { Plugin } from "@opencode-ai/plugin";
import { join } from "node:path";
import { getGlobalConfigPath, getPackageVersion, install } from "./src/installer.ts";
import { ScopeResolver } from "./src/scope-resolver.ts";

const VERSION_MARKER_SKILL: string = "aurelia-expert";

const plugin: Plugin = async ({ directory }) => ({
  config: async () => {
    const version: string = await getPackageVersion();
    const globalConfigPath: string = getGlobalConfigPath();
    const scope = ScopeResolver.resolve(directory, globalConfigPath);
    const base: string = scope === "global" ? globalConfigPath : directory;
    const versionMarker: string = join(base, "skills", VERSION_MARKER_SKILL, ".version");

    let installedVersion: string = "";
    try {
      installedVersion = (await Bun.file(versionMarker).text()).trim();
    } catch {
      installedVersion = "";
    }

    if (installedVersion === version) {
      return;
    }
    await install(scope, directory);
  },
});

export default plugin;