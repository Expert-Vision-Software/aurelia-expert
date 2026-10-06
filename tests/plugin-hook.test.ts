import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { exists, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import plugin from "../src/plugin.ts";

type PluginFactory = typeof plugin;
type PluginInput = Parameters<PluginFactory>[0];
type ConfigHook = () => Promise<void>;

interface HookHarness {
  directory: string;
  globalDir: string;
  config: ConfigHook;
  globalConfigPath: string;
  brokenSkillFile: string;
}

function captureConsoleWarn(): { warnings: string[]; restore: () => void } {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
  return { warnings, restore: () => { console.warn = original; } };
}

async function makeHarness(): Promise<HookHarness> {
  const tmpRoot: string = tmpdir();
  const directory: string = await mkdtemp(join(tmpRoot, "aurelia-hook-project-"));
  const globalDir: string = await mkdtemp(join(tmpRoot, "aurelia-hook-global-"));
  process.env.XDG_CONFIG_HOME = globalDir;
  const factory: PluginFactory = plugin;
  const hooks = await factory({
    directory,
    client: undefined,
  } as unknown as PluginInput);
  const config: ConfigHook = hooks.config as ConfigHook;
  const globalConfigPath: string = join(globalDir, "opencode", "opencode.json");
  const brokenSkillFile: string = join(globalDir, "opencode", "skills", "aurelia-expert", "SKILL.md");
  return { directory, globalDir, config, globalConfigPath, brokenSkillFile };
}

async function registerGlobally(harness: HookHarness): Promise<void> {
  await mkdir(join(harness.globalDir, "opencode"), { recursive: true });
  await writeFile(harness.globalConfigPath, JSON.stringify({ plugin: ["aurelia-expert"] }, null, 2));
}

async function breakInstallTarget(harness: HookHarness): Promise<void> {
  await mkdir(harness.brokenSkillFile, { recursive: true });
}

async function cleanupHarness(harness: HookHarness): Promise<void> {
  delete process.env.XDG_CONFIG_HOME;
  if (await exists(harness.directory)) {
    await rm(harness.directory, { recursive: true });
  }
  if (await exists(harness.globalDir)) {
    await rm(harness.globalDir, { recursive: true });
  }
}

const FAILURE_ADVISORY_MARKER: string = "failed to install bundled skills at load";
const INSTALL_ADVISORY_MARKER: string = "is not installed in any scope";

describe("plugin config hook failure advisory", () => {
  let harness: HookHarness;

  beforeEach(async () => {
    harness = await makeHarness();
  });

  afterEach(async () => {
    await cleanupHarness(harness);
  });

  test("repeated config() invocations with a forced install failure emit exactly one failure advisory", async () => {
    await registerGlobally(harness);
    await breakInstallTarget(harness);
    const capture = captureConsoleWarn();

    let firstError: unknown = null;
    let secondError: unknown = null;
    try {
      try {
        await harness.config();
      } catch (error) {
        firstError = error;
      }
      try {
        await harness.config();
      } catch (error) {
        secondError = error;
      }
    } finally {
      capture.restore();
    }

    expect(firstError).toBeNull();
    expect(secondError).toBeNull();
    const failureAdvisories = capture.warnings.filter(w => w.includes(FAILURE_ADVISORY_MARKER));
    expect(failureAdvisories.length).toBe(1);
    expect(failureAdvisories[0]).toContain("bunx aurelia-expert clear-cache");
  });

  test("failure advisory guard is independent of the install advisory guard", async () => {
    const capture = captureConsoleWarn();

    try {
      await harness.config();
      await registerGlobally(harness);
      await breakInstallTarget(harness);
      await harness.config();
    } finally {
      capture.restore();
    }

    const installAdvisories = capture.warnings.filter(w => w.includes(INSTALL_ADVISORY_MARKER));
    const failureAdvisories = capture.warnings.filter(w => w.includes(FAILURE_ADVISORY_MARKER));
    expect(installAdvisories.length).toBe(1);
    expect(failureAdvisories.length).toBe(1);
  });
});
