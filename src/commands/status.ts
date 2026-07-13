import { status } from "../installer.ts";

export async function statusCommand(): Promise<void> {
  const result = await status();

  if (!result.installed) {
    console.log("aurelia-expert is not installed.");
    return;
  }

  console.log(`aurelia-expert [${result.scope}]`);
  console.log("  Installed: yes");
  if (result.version !== null) {
    console.log(`  Version: ${result.version}`);
  }
  console.log(`  Plugin in config: ${result.pluginInConfig ? "yes" : "no"}`);
}