#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { installCommand } from "./commands/install.ts";
import { uninstallCommand } from "./commands/uninstall.ts";
import { statusCommand } from "./commands/status.ts";
import type { Scope } from "./installer.ts";

const VERSION: string = JSON.parse(
  await Bun.file(join(fileURLToPath(new URL("../", import.meta.url)), "package.json")).text(),
).version;

function printHelp(): void {
  console.log(`
aurelia-expert v${VERSION}

Eight router-routed Aurelia v2 MVVM skills for AI coding agents.

Commands:
  install     Copy skills to .opencode/skills/ (or the global config dir), grant
              skill permissions, register aurelia-expert@latest, and write an
              install manifest used for idempotent, drift-aware re-installs
  uninstall   Remove installed skills and the plugin entry
  status      Check installation status per scope

Options:
  -s, --scope <scope>    Installation scope: "local" (default) or "global"
      --force            Overwrite consumer-modified installed files
      --migrate-root-config
                         Migrate a root opencode.json into .opencode/opencode.json
                         during local install (off by default; opt in explicitly)
      --no-migrate-root-config
                         Explicitly keep root-config migration off (default)
  -h, --help             Show this help message
  -v, --version          Show version

Examples:
  bunx aurelia-expert install
  bunx aurelia-expert install --scope global
  bunx aurelia-expert uninstall --scope local
  bunx aurelia-expert status
`);
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    options: {
      scope: { type: "string", short: "s" },
      force: { type: "boolean", default: false },
      "migrate-root-config": { type: "boolean", default: false },
      "no-migrate-root-config": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.version) {
    console.log(`aurelia-expert v${VERSION}`);
    process.exit(0);
  }

  if (values.help === true || positionals.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command: string = positionals[0] ?? "";
  const scopeArg: string | undefined = values.scope as string | undefined;

  if (scopeArg !== undefined && scopeArg !== "local" && scopeArg !== "global") {
    console.error(`Invalid scope: ${scopeArg}. Must be "local" or "global".`);
    process.exit(1);
  }

  const scope: Scope | null = scopeArg === undefined ? null : (scopeArg as Scope);
  const force: boolean = values.force === true;
  const migrateRootConfig: boolean =
    values["migrate-root-config"] === true && values["no-migrate-root-config"] !== true;

  try {
    await dispatch(command, scope, force, migrateRootConfig);
  } catch (error) {
    const message: string = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

async function dispatch(
  command: string,
  scope: Scope | null,
  force: boolean,
  migrateRootConfig: boolean,
): Promise<void> {
  switch (command) {
    case "install":
      await installCommand({ scope, force, migrateRootConfig });
      return;
    case "uninstall":
      await uninstallCommand({ scope });
      return;
    case "status":
      await statusCommand();
      return;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

await main();