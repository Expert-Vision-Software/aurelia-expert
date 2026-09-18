import { install, type Scope } from "../installer.ts";

export interface InstallOptions {
  scope: Scope | null;
  force: boolean;
  migrateRootConfig: boolean;
}

export async function installCommand(options: InstallOptions): Promise<void> {
  const scope: Scope = options.scope ?? "local";
  const result = await install(scope, process.cwd(), {
    addPluginConfig: true,
    migrateRootConfig: options.migrateRootConfig,
    force: options.force,
  });

  if (result.action === "noop") {
    console.log(`aurelia-expert already up to date (${scope === "global" ? "global" : "local"}).`);
    return;
  }

  console.log(
    `aurelia-expert ${result.action === "upgraded" ? "upgraded" : "installed"} ` +
      `${scope === "global" ? "globally" : "locally"}:`,
  );
  for (const p of result.skillPaths) {
    console.log(`  ${p}`);
  }
  for (const p of result.skipped) {
    console.log(`  Skipped consumer-modified file (re-run with --force to overwrite): ${p}`);
  }
  if (result.migrated) {
    console.log("  Migrated: opencode.json → .opencode/opencode.json");
  }
  if (result.permissionConfigured) {
    console.log("  Permission: skill.allow granted for all 8 skills");
  }
  if (result.pluginAdded) {
    console.log("  Plugin: aurelia-expert@latest registered in opencode.json");
  }
}
