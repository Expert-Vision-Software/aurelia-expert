import { status } from "../installer.ts";

export async function statusCommand(): Promise<void> {
  const result = await status();

  let printed: boolean = false;
  for (const [label, scopeStatus] of [["local", result.local], ["global", result.global]] as const) {
    if (scopeStatus === null) {
      continue;
    }
    printed = true;
    const edition: string = scopeStatus.legacy ? " (legacy pre-manifest install)" : "";
    console.log(`aurelia-expert [${label}]`);
    console.log(`  Installed: yes${edition}`);
    if (scopeStatus.version !== null) {
      console.log(`  Version: ${scopeStatus.version}`);
    }
    console.log(`  Plugin in config: ${scopeStatus.pluginInConfig ? "yes" : "no"}`);
  }

  if (!printed) {
    console.log("aurelia-expert is not installed.");
  }
}
