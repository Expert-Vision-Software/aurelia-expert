import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { exists, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Plugin } from "@opencode/plugin/effect";
import { Effect } from "effect";
import { installManifestPath } from "../src/installer.ts";
import plugin from "../plugin.ts";
import indexExport from "../index.ts";
import pluginSourceExport from "../src/plugin.ts";

interface Sandbox {
  projectDir: string;
  globalDir: string;
  localBase: string;
  globalBase: string;
}

async function makeSandbox(): Promise<Sandbox> {
  const tmpRoot: string = tmpdir();
  const projectDir: string = await mkdtemp(join(tmpRoot, "aurelia-plugin-project-"));
  const globalDir: string = await mkdtemp(join(tmpRoot, "aurelia-plugin-global-"));
  return {
    projectDir,
    globalDir,
    localBase: join(projectDir, ".opencode"),
    globalBase: join(globalDir, "opencode"),
  };
}

async function cleanupSandbox(sandbox: Sandbox): Promise<void> {
  if (await exists(sandbox.projectDir)) {
    await rm(sandbox.projectDir, { recursive: true });
  }
  if (await exists(sandbox.globalDir)) {
    await rm(sandbox.globalDir, { recursive: true });
  }
  delete process.env.XDG_CONFIG_HOME;
}

function makeContext(directory: string): Plugin.Context {
  return { location: { directory } } as unknown as Plugin.Context;
}

async function runLoad(directory: string): Promise<void> {
  await Effect.runPromise(plugin.effect(makeContext(directory)));
}

interface WarnSpy {
  mock: { calls: Array<Array<unknown>> };
}

function warnMessages(spy: WarnSpy): string[] {
  return spy.mock.calls.map(call => String(call[0]));
}

async function writeLocalPluginConfig(sandbox: Sandbox): Promise<void> {
  await mkdir(sandbox.localBase, { recursive: true });
  await writeFile(
    join(sandbox.localBase, "opencode.json"),
    JSON.stringify({ plugin: ["aurelia-expert"] }, null, 2),
  );
}

describe("v2 plugin shape", () => {
  test("default export declares the aurelia-expert id and an effect function", () => {
    expect(plugin.id).toBe("aurelia-expert");
    expect(typeof plugin.effect).toBe("function");
  });

  test("root plugin.ts and index.ts re-export the v2 plugin", () => {
    expect(pluginSourceExport).toBe(plugin);
    expect(indexExport).toBe(plugin);
  });
});

describe("install on load", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
    process.env.XDG_CONFIG_HOME = sandbox.globalDir;
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("installs the skills into a registered repo-local scope", async () => {
    await writeLocalPluginConfig(sandbox);

    await runLoad(sandbox.projectDir);

    const installedSkill: string = join(sandbox.localBase, "skills", "aurelia-expert", "SKILL.md");
    expect(await exists(installedSkill)).toBe(true);
    expect(await exists(installManifestPath(sandbox.localBase, "aurelia-expert"))).toBe(true);
  });

  test("emits the install advisory at most once per directory and performs no writes when nothing is installed", async () => {
    const spy = spyOn(console, "warn");
    try {
      await runLoad(sandbox.projectDir);
      await runLoad(sandbox.projectDir);
      const secondDir: string = await mkdtemp(join(tmpdir(), "aurelia-plugin-second-"));
      try {
        await runLoad(secondDir);
      } finally {
        await rm(secondDir, { recursive: true, force: true });
      }

      const advisories: string[] = warnMessages(spy).filter(message =>
        message.includes("aurelia-expert is not installed in any scope"),
      );
      expect(advisories.length).toBe(2);
      expect(await exists(join(sandbox.localBase, "skills"))).toBe(false);
      expect(await exists(join(sandbox.globalBase, "skills"))).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  test("warns about consumer-modified skipped files on a later load", async () => {
    await writeLocalPluginConfig(sandbox);
    await runLoad(sandbox.projectDir);

    const modifiedSkill: string = join(sandbox.localBase, "skills", "aurelia-foundation", "SKILL.md");
    await writeFile(modifiedSkill, `${await Bun.file(modifiedSkill).text()}\nconsumer edit\n`);

    const spy = spyOn(console, "warn");
    try {
      await runLoad(sandbox.projectDir);

      const skippedWarnings: string[] = warnMessages(spy).filter(message =>
        message.includes("Skipped consumer-modified file") && message.includes("aurelia-foundation"),
      );
      expect(skippedWarnings.length).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});
