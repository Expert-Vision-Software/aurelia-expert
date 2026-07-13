import { uninstall, type Scope } from "../installer.ts";

export interface UninstallOptions {
  scope: Scope | null;
}

export async function uninstallCommand(options: UninstallOptions): Promise<void> {
  const scope: Scope = options.scope ?? "local";
  const result = await uninstall(scope);

  if (result.removed.length === 0) {
    console.log("aurelia-expert is not installed.");
    return;
  }

  console.log(`aurelia-expert uninstalled ${scope === "global" ? "globally" : "locally"}:`);
  for (const p of result.removed) {
    console.log(`  Removed: ${p}`);
  }
  if (result.pluginRemoved) {
    console.log("  Plugin entry removed from opencode.json");
  }
}