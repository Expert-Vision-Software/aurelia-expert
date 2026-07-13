import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { exists, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Installer, type Scope } from "../src/installer.ts";

const PACKAGE_ROOT: string = join(import.meta.dir, "..");
const SKILL_NAMES: readonly string[] = Installer.skillNames();

function makeInstaller(globalDir: string): Installer {
  process.env.XDG_CONFIG_HOME = globalDir;
  return new Installer(PACKAGE_ROOT);
}

describe("Installer.install (local)", () => {
  let projectDir: string;
  let globalDir: string;
  let installer: Installer;

  beforeEach(async () => {
    const tmpRoot: string = tmpdir();
    projectDir = await mkdtemp(join(tmpRoot, "aurelia-skill-test-project-"));
    globalDir = await mkdtemp(join(tmpRoot, "aurelia-skill-test-global-"));
    installer = makeInstaller(globalDir);
  });

  afterEach(async () => {
    if (await exists(projectDir)) {
      await rm(projectDir, { recursive: true });
    }
    if (await exists(globalDir)) {
      await rm(globalDir, { recursive: true });
    }
    delete process.env.XDG_CONFIG_HOME;
  });

  test("copies every bundled skill and writes a .version marker", async () => {
    const result = await installer.install("local", projectDir);

    expect(result.scope).toBe<Scope>("local");
    expect(result.skillPaths.length).toBe(SKILL_NAMES.length);
    for (const path of result.skillPaths) {
      expect(await exists(join(path, "SKILL.md"))).toBe(true);
      const marker: string = await readFile(join(path, ".version"), "utf-8");
      expect(marker.length).toBeGreaterThan(0);
    }
  });

  test("writes permission.skill.allow for every bundled skill", async () => {
    await installer.install("local", projectDir);

    const configPath: string = join(projectDir, ".opencode", "opencode.json");
    const config = JSON.parse(await readFile(configPath, "utf-8")) as {
      permission?: { skill?: Record<string, string> };
    };
    expect(config.permission).toBeDefined();
    expect(config.permission?.skill).toBeDefined();
    for (const name of SKILL_NAMES) {
      expect(config.permission?.skill?.[name]).toBe("allow");
    }
  });

  test("adds aurelia-expert to plugin[] in opencode.json", async () => {
    await installer.install("local", projectDir);

    const configPath: string = join(projectDir, ".opencode", "opencode.json");
    const config = JSON.parse(await readFile(configPath, "utf-8")) as {
      plugin?: string[];
    };
    expect(config.plugin).toBeDefined();
    expect(config.plugin?.includes("aurelia-expert")).toBe(true);
  });

  test("is idempotent: second install does not duplicate the plugin entry", async () => {
    await installer.install("local", projectDir);
    const configPath: string = join(projectDir, ".opencode", "opencode.json");
    await writeFile(
      configPath,
      JSON.stringify(
        {
          plugin: ["aurelia-expert@latest", "Aurelia-Expert", "some-other-pkg"],
          permission: { skill: { "aurelia-expert": "allow" } },
        },
        null,
        2,
      ),
    );

    const result = await installer.install("local", projectDir);

    const config = JSON.parse(await readFile(configPath, "utf-8")) as {
      plugin?: string[];
    };
    expect(config.plugin).toBeDefined();
    if (config.plugin === undefined) {
      return;
    }
    const ourEntries: string[] = config.plugin.filter((entry) =>
      entry.toLowerCase().startsWith("aurelia-expert"),
    );
    expect(ourEntries.length).toBe(2);
    expect(config.plugin).toContain("some-other-pkg");
    expect(result.pluginAdded).toBe(false);
  });

  test("migrates a legacy root opencode.json into .opencode/opencode.json", async () => {
    await writeFile(
      join(projectDir, "opencode.json"),
      JSON.stringify({ permission: { skill: { "aurelia-expert": "allow" } } }, null, 2),
    );

    const result = await installer.install("local", projectDir);

    expect(result.migrated).toBe(true);
    expect(await exists(join(projectDir, "opencode.json"))).toBe(false);
    expect(await exists(join(projectDir, ".opencode", "opencode.json"))).toBe(true);
  });
});

describe("Installer.uninstall", () => {
  let projectDir: string;
  let globalDir: string;
  let installer: Installer;

  beforeEach(async () => {
    const tmpRoot: string = tmpdir();
    projectDir = await mkdtemp(join(tmpRoot, "aurelia-skill-test-project-"));
    globalDir = await mkdtemp(join(tmpRoot, "aurelia-skill-test-global-"));
    installer = makeInstaller(globalDir);
    await installer.install("local", projectDir);
  });

  afterEach(async () => {
    if (await exists(projectDir)) {
      await rm(projectDir, { recursive: true });
    }
    if (await exists(globalDir)) {
      await rm(globalDir, { recursive: true });
    }
    delete process.env.XDG_CONFIG_HOME;
  });

  test("removes every skill directory and the plugin entry", async () => {
    const result = await installer.uninstall("local", projectDir);

    expect(result.removed.length).toBe(SKILL_NAMES.length);
    for (const path of result.removed) {
      expect(await exists(path)).toBe(false);
    }
    expect(result.pluginRemoved).toBe(true);

    const configPath: string = join(projectDir, ".opencode", "opencode.json");
    const config = JSON.parse(await readFile(configPath, "utf-8")) as {
      plugin?: string[];
    };
    expect(config.plugin).toBeUndefined();
  });
});

describe("Installer.status", () => {
  let projectDir: string;
  let globalDir: string;

  beforeEach(async () => {
    const tmpRoot: string = tmpdir();
    projectDir = await mkdtemp(join(tmpRoot, "aurelia-skill-test-project-"));
    globalDir = await mkdtemp(join(tmpRoot, "aurelia-skill-test-global-"));
  });

  afterEach(async () => {
    if (await exists(projectDir)) {
      await rm(projectDir, { recursive: true });
    }
    if (await exists(globalDir)) {
      await rm(globalDir, { recursive: true });
    }
    delete process.env.XDG_CONFIG_HOME;
  });

  test("reports not-installed when no skills are present", async () => {
    const installer: Installer = makeInstaller(globalDir);
    const result = await installer.status(projectDir);
    expect(result.installed).toBe(false);
    expect(result.scope).toBeNull();
    expect(result.version).toBeNull();
  });

  test("reports installed + version + scope after install", async () => {
    const installer: Installer = makeInstaller(globalDir);
    await installer.install("local", projectDir);
    const result = await installer.status(projectDir);
    expect(result.installed).toBe(true);
    expect(result.scope).toBe<Scope>("local");
    expect(result.version).not.toBeNull();
    expect(result.pluginInConfig).toBe(true);
  });
});