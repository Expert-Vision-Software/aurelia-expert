import { install, type Scope } from "../installer.ts";

export interface InstallOptions {
  scope: Scope | null;
}

export async function installCommand(options: InstallOptions): Promise<void> {
  const scope: Scope = options.scope ?? "local";
  const result = await install(scope);

  console.log(
    `aurelia-expert installed ${scope === "global" ? "globally" : "locally"}:`,
  );
  for (const p of result.skillPaths) {
    console.log(`  ${p}`);
  }
  if (result.migrated) {
    console.log("  Migrated: opencode.json → .opencode/opencode.json");
  }
  if (result.permissionConfigured) {
    console.log("  Permission: skill.allow granted for all 5 skills");
  }
  if (result.pluginAdded) {
    console.log("  Plugin: aurelia-expert registered in opencode.json");
  }
}