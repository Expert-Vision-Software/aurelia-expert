import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { exists, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Installer,
  LOAD_INSTALL_OPTIONS,
  installManifestPath,
  type PermissionRule,
  type Scope,
} from "../src/installer.ts";
import { RegistrationDetector } from "../src/registration.ts";

const PACKAGE_ROOT: string = join(import.meta.dir, "..");
const SKILL_NAMES: readonly string[] = Installer.skillNames();

function makeInstaller(globalDir: string): Installer {
  process.env.XDG_CONFIG_HOME = globalDir;
  return new Installer(PACKAGE_ROOT);
}

interface Sandbox {
  projectDir: string;
  globalDir: string;
  installer: Installer;
  localConfigPath: string;
  globalConfigPath: string;
  localManifestPath: string;
  globalManifestPath: string;
}

async function readConfig(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf-8")) as Record<string, unknown>;
}

async function readRules(path: string): Promise<PermissionRule[]> {
  const config: Record<string, unknown> = await readConfig(path);
  return (config.permissions ?? []) as PermissionRule[];
}

async function makeSandbox(): Promise<Sandbox> {
  const tmpRoot: string = tmpdir();
  const projectDir: string = await mkdtemp(join(tmpRoot, "aurelia-test-project-"));
  const globalDir: string = await mkdtemp(join(tmpRoot, "aurelia-test-global-"));
  const installer: Installer = makeInstaller(globalDir);
  const globalBase: string = join(globalDir, "opencode");
  return {
    projectDir,
    globalDir,
    installer,
    localConfigPath: join(projectDir, ".opencode", "opencode.json"),
    globalConfigPath: join(globalBase, "opencode.json"),
    localManifestPath: installManifestPath(join(projectDir, ".opencode"), "aurelia-expert"),
    globalManifestPath: installManifestPath(globalBase, "aurelia-expert"),
  };
}

async function writeConfig(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
}

async function writeRawConfig(path: string, text: string): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, text);
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

describe("manifest-gated install", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("fresh install copies every skill, writes v2 permission rules, manifest, and plugins entry", async () => {
    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.action).toBe("installed");
    expect(result.skillPaths.length).toBe(SKILL_NAMES.length);
    for (const path of result.skillPaths) {
      expect(await exists(join(path, "SKILL.md"))).toBe(true);
      expect(await exists(join(path, ".version"))).toBe(false);
    }
    expect(await exists(sandbox.localManifestPath)).toBe(true);

    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    const rules: PermissionRule[] = config.permissions as PermissionRule[];
    for (const name of SKILL_NAMES) {
      expect(rules).toContainEqual({ action: "skill", resource: name, effect: "allow" });
    }
    expect(config.permission).toBeUndefined();
    const plugins: string[] = config.plugins as string[];
    expect(plugins).toContain("aurelia-expert@latest");
    expect(config.plugin).toBeUndefined();
    expect(result.pluginAdded).toBe(true);
    expect(result.permissionConfigured).toBe(true);
  });

  test("up-to-date scope is a zero-write noop", async () => {
    await sandbox.installer.install("local", sandbox.projectDir);
    const configBefore: string = await readFile(sandbox.localConfigPath, "utf-8");
    const manifestBefore: string = await readFile(sandbox.localManifestPath, "utf-8");

    const result = await sandbox.installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);

    expect(result.action).toBe("noop");
    expect(await readFile(sandbox.localConfigPath, "utf-8")).toBe(configBefore);
    expect(await readFile(sandbox.localManifestPath, "utf-8")).toBe(manifestBefore);
  });

  test("version drift upgrades the installed scope and rewrites the manifest", async () => {
    await sandbox.installer.install("local", sandbox.projectDir);
    const manifest: Record<string, unknown> = await readConfig(sandbox.localManifestPath);
    manifest.version = "0.0.1";
    await writeFile(sandbox.localManifestPath, JSON.stringify(manifest, null, 2));

    const result = await sandbox.installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);

    expect(result.action).toBe("upgraded");
    const rewritten: Record<string, unknown> = await readConfig(sandbox.localManifestPath);
    expect(rewritten.version).not.toBe("0.0.1");
  });

  test("consumer-modified installed files are skipped unless forced", async () => {
    await sandbox.installer.install("local", sandbox.projectDir);
    const skillFile: string = join(sandbox.projectDir, ".opencode", "skills", SKILL_NAMES[0], "SKILL.md");
    await writeFile(skillFile, "consumer edit");

    const skipped: Awaited<ReturnType<Installer["install"]>> =
      await sandbox.installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);
    expect(skipped.action).toBe("noop");
    expect(skipped.skipped.length).toBeGreaterThan(0);

    const forced = await sandbox.installer.install("local", sandbox.projectDir, {
      addPluginConfig: false,
      migrateRootConfig: false,
      force: true,
    });
    expect(forced.skipped.length).toBe(0);
    expect(await readFile(skillFile, "utf-8")).not.toBe("consumer edit");
  });

  test("unreadable manifest refuses to overwrite files unless forced", async () => {
    await sandbox.installer.install("local", sandbox.projectDir);
    const skillFile: string = join(sandbox.projectDir, ".opencode", "skills", SKILL_NAMES[0], "SKILL.md");
    await writeRawConfig(sandbox.localManifestPath, "{ corrupt");
    await writeFile(skillFile, "consumer edit");

    const refused: Awaited<ReturnType<Installer["install"]>> =
      await sandbox.installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);
    expect(refused.action).toBe("noop");
    expect(await readFile(skillFile, "utf-8")).toBe("consumer edit");
    expect(await readFile(sandbox.localManifestPath, "utf-8")).toBe("{ corrupt");

    const forced = await sandbox.installer.install("local", sandbox.projectDir, {
      addPluginConfig: false,
      migrateRootConfig: false,
      force: true,
    });
    expect(forced.action).toBe("installed");
    expect(await readFile(skillFile, "utf-8")).not.toBe("consumer edit");
    expect((await readConfig(sandbox.localManifestPath)).version).not.toBeUndefined();
  });

  test("retires legacy .version markers on first manifest-era install", async () => {
    await sandbox.installer.install("local", sandbox.projectDir);
    const legacyDir: string = join(sandbox.projectDir, ".opencode", "skills", SKILL_NAMES[0]);
    await rm(sandbox.localManifestPath);
    await writeFile(join(legacyDir, ".version"), "0.3.0");

    const result = await sandbox.installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);

    expect(result.action).toBe("installed");
    expect(await exists(join(legacyDir, ".version"))).toBe(false);
    expect(await exists(sandbox.localManifestPath)).toBe(true);
  });
});

describe("v2 permission ruleset", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("writes exactly one allow rule per owned skill id", async () => {
    await sandbox.installer.install("local", sandbox.projectDir);

    const rules: PermissionRule[] = await readRules(sandbox.localConfigPath);
    expect(rules.length).toBe(SKILL_NAMES.length);
    for (const name of SKILL_NAMES) {
      expect(rules).toContainEqual({ action: "skill", resource: name, effect: "allow" });
    }
  });

  test("existing allow rules are not duplicated on install", async () => {
    await writeConfig(sandbox.localConfigPath, {
      permissions: SKILL_NAMES.map(name => ({ action: "skill", resource: name, effect: "allow" })),
    });

    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.permissionConfigured).toBe(false);
    const rules: PermissionRule[] = await readRules(sandbox.localConfigPath);
    expect(rules.length).toBe(SKILL_NAMES.length);
  });

  test("consumer glob coverage suppresses new rules", async () => {
    await writeConfig(sandbox.localConfigPath, {
      permissions: [{ action: "skill", resource: "aurelia-*", effect: "allow" }],
    });

    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.permissionConfigured).toBe(false);
    expect((await readRules(sandbox.localConfigPath)).length).toBe(1);
  });

  test("unrelated consumer rules are preserved and our rules append after them", async () => {
    const consumerRule: PermissionRule = { action: "shell", resource: "git push *", effect: "deny" };
    await writeConfig(sandbox.localConfigPath, { permissions: [consumerRule] });

    await sandbox.installer.install("local", sandbox.projectDir);

    const rules: PermissionRule[] = await readRules(sandbox.localConfigPath);
    expect(rules[0]).toEqual(consumerRule);
    expect(rules.length).toBe(SKILL_NAMES.length + 1);
    for (const name of SKILL_NAMES) {
      expect(rules).toContainEqual({ action: "skill", resource: name, effect: "allow" });
    }
  });

  test("non-array permissions key is refused and the file stays byte-for-byte", async () => {
    const raw: string = JSON.stringify({ permissions: "all" });
    await writeRawConfig(sandbox.localConfigPath, raw);

    const result = await sandbox.installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);

    expect(result.permissionConfigured).toBe(false);
    expect(await readFile(sandbox.localConfigPath, "utf-8")).toBe(raw);
  });
});

describe("legacy permission migration", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("migrates v1 permission.skill records for owned ids into the v2 ruleset", async () => {
    await writeConfig(sandbox.localConfigPath, {
      permission: {
        skill: {
          "aurelia-expert": "allow",
          "aurelia-runtime": "allow",
          "some-other-skill": "allow",
        },
      },
    });

    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.permissionConfigured).toBe(true);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    const rules: PermissionRule[] = config.permissions as PermissionRule[];
    for (const name of SKILL_NAMES) {
      expect(rules).toContainEqual({ action: "skill", resource: name, effect: "allow" });
    }
    const legacy = config.permission as { skill: Record<string, string> };
    expect(legacy.skill).toEqual({ "some-other-skill": "allow" });
  });

  test("drops the legacy skill record and permission container once emptied", async () => {
    await writeConfig(sandbox.localConfigPath, {
      permission: { skill: { "aurelia-expert": "allow" } },
    });

    await sandbox.installer.install("local", sandbox.projectDir);

    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    expect(config.permission).toBeUndefined();
    const rules: PermissionRule[] = config.permissions as PermissionRule[];
    for (const name of SKILL_NAMES) {
      expect(rules).toContainEqual({ action: "skill", resource: name, effect: "allow" });
    }
  });

  test("legacy records for unrelated skills keep the permission object alive", async () => {
    await writeConfig(sandbox.localConfigPath, {
      permission: {
        skill: { "aurelia-foundation": "allow" },
        bash: { "rm *": "deny" },
      },
    });

    await sandbox.installer.install("local", sandbox.projectDir);

    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    const legacy = config.permission as Record<string, unknown>;
    expect(legacy.skill).toBeUndefined();
    expect(legacy.bash).toEqual({ "rm *": "deny" });
  });
});

describe("v2 plugins array and legacy plugin key", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("consumer plugins array gains our canonical entry and keeps its own entries", async () => {
    await writeConfig(sandbox.localConfigPath, { plugins: ["some-other-pkg"] });

    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.pluginAdded).toBe(true);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    expect(config.plugins).toEqual(["some-other-pkg", "aurelia-expert@latest"]);
    expect(config.plugin).toBeUndefined();
  });

  test("object-form plugin entries are matched by package name", async () => {
    await writeConfig(sandbox.localConfigPath, {
      plugins: [{ package: "aurelia-expert", options: { enabled: true } }],
    });

    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.pluginAdded).toBe(false);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    const plugins: Array<Record<string, unknown>> = config.plugins as Array<Record<string, unknown>>;
    expect(plugins.length).toBe(1);
    expect(plugins[0].package).toBe("aurelia-expert");
  });

  test("detection counts a legacy plugin entry as registered without duplicating into plugins", async () => {
    await writeConfig(sandbox.localConfigPath, { plugin: ["aurelia-expert@1.0.0"] });

    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.pluginAdded).toBe(false);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    expect(config.plugins).toBeUndefined();
    expect(config.plugin).toEqual(["aurelia-expert@1.0.0"]);
  });

  test("plugins-present wins: a dead legacy entry does not block a fresh v2 registration", async () => {
    await writeConfig(sandbox.localConfigPath, { plugins: ["other-pkg"], plugin: ["aurelia-expert"] });

    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.pluginAdded).toBe(true);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    expect(config.plugins).toEqual(["other-pkg", "aurelia-expert@latest"]);
    expect(config.plugin).toEqual(["aurelia-expert"]);
  });

  test("malformed plugins key falls back to legacy detection instead of a false not-registered", async () => {
    await writeConfig(sandbox.localConfigPath, {
      plugins: { broken: true },
      plugin: ["aurelia-expert"],
    });

    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.pluginAdded).toBe(false);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    expect(config.plugin).toEqual(["aurelia-expert"]);
    expect(config.plugins).toEqual({ broken: true });
  });

  test("non-array plugins key is refused and the file stays byte-for-byte", async () => {
    const seeded: Record<string, unknown> = {
      plugins: "aurelia-expert",
      permissions: SKILL_NAMES.map(name => ({ action: "skill", resource: name, effect: "allow" })),
    };
    const raw: string = JSON.stringify(seeded, null, 2);
    await writeRawConfig(sandbox.localConfigPath, raw);

    const result = await sandbox.installer.install("local", sandbox.projectDir, {
      addPluginConfig: true,
      migrateRootConfig: false,
      force: false,
    });

    expect(result.pluginAdded).toBe(false);
    expect(result.permissionConfigured).toBe(false);
    expect(await readFile(sandbox.localConfigPath, "utf-8")).toBe(raw);
  });

  test("uninstall removes our entries from both keys and leaves unrelated entries", async () => {
    await writeConfig(sandbox.localConfigPath, {
      plugins: ["aurelia-expert@latest", "keep-me"],
      plugin: ["aurelia-expert", "also-keep-me"],
    });

    const result = await sandbox.installer.uninstall("local", sandbox.projectDir);

    expect(result.pluginRemoved).toBe(true);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    expect(config.plugins).toEqual(["keep-me"]);
    expect(config.plugin).toEqual(["also-keep-me"]);
  });

  test("uninstall removes a legacy-only entry and drops the emptied key", async () => {
    await writeConfig(sandbox.localConfigPath, { plugin: ["aurelia-expert"] });

    const result = await sandbox.installer.uninstall("local", sandbox.projectDir);

    expect(result.pluginRemoved).toBe(true);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    expect(config.plugin).toBeUndefined();
    expect(config.plugins).toBeUndefined();
  });
});

describe("CLI-only behaviors at load", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("load options never add the plugins entry", async () => {
    await writeConfig(sandbox.localConfigPath, { theme: "dark" });

    await sandbox.installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);

    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    expect(config.plugins).toBeUndefined();
    expect(config.plugin).toBeUndefined();
    expect(config.theme).toBe("dark");
  });

  test("load options never migrate or delete the root opencode.json", async () => {
    const rootConfig: string = join(sandbox.projectDir, "opencode.json");
    await writeConfig(rootConfig, { theme: "root" });

    await sandbox.installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);

    expect(await exists(rootConfig)).toBe(true);
    expect(await exists(join(sandbox.projectDir, ".opencode"))).toBe(true);
    const root: Record<string, unknown> = await readConfig(rootConfig);
    expect(root.theme).toBe("root");
  });

  test("CLI default install does not migrate or delete the root opencode.json", async () => {
    const rootConfig: string = join(sandbox.projectDir, "opencode.json");
    await writeConfig(rootConfig, { theme: "root" });

    const result = await sandbox.installer.install("local", sandbox.projectDir, {
      addPluginConfig: true,
      migrateRootConfig: false,
      force: false,
    });

    expect(result.migrated).toBe(false);
    expect(await exists(rootConfig)).toBe(true);
    expect(await exists(sandbox.localConfigPath)).toBe(true);
  });

  test("CLI --migrate-root-config enables root-config migration", async () => {
    const rootConfig: string = join(sandbox.projectDir, "opencode.json");
    await writeConfig(rootConfig, { theme: "root" });

    const result = await sandbox.installer.install("local", sandbox.projectDir, {
      addPluginConfig: true,
      migrateRootConfig: true,
      force: false,
    });

    expect(result.migrated).toBe(true);
    expect(await exists(rootConfig)).toBe(false);
    expect(await exists(sandbox.localConfigPath)).toBe(true);
  });
});

describe("hardened config writes", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("unparseable local config is preserved, never rewritten from {}", async () => {
    const garbage: string = "{ not json !!!";
    await writeRawConfig(sandbox.localConfigPath, garbage);

    const result: Awaited<ReturnType<Installer["install"]>> =
      await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.permissionConfigured).toBe(false);
    expect(result.pluginAdded).toBe(false);
    expect(await readFile(sandbox.localConfigPath, "utf-8")).toBe(garbage);
  });

  test("unparseable root config blocks migration and stays byte-for-byte intact", async () => {
    const rootConfig: string = join(sandbox.projectDir, "opencode.json");
    const garbage: string = "{ nope";
    await writeRawConfig(rootConfig, garbage);

    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.migrated).toBe(false);
    expect(await exists(rootConfig)).toBe(true);
    expect(await readFile(rootConfig, "utf-8")).toBe(garbage);
  });

  test("plugin dedup is semantic across name, @latest, version, and case variants", async () => {
    await writeConfig(
      sandbox.localConfigPath,
      { plugins: ["aurelia-expert@latest", "Aurelia-Expert", "some-other-pkg"] },
    );

    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.pluginAdded).toBe(false);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    const plugins: unknown[] = config.plugins as unknown[];
    expect(
      plugins.filter(
        entry => typeof entry === "string" && entry.toLowerCase().startsWith("aurelia-expert"),
      ).length,
    ).toBe(2);
    expect(plugins).toContain("some-other-pkg");
  });
});

describe("regression contract table", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("global context: zero repo writes, global assets + manifest ensured", async () => {
    await writeConfig(sandbox.globalConfigPath, { plugins: ["aurelia-expert"] });

    const context = await RegistrationDetector.detect(sandbox.projectDir);
    expect(context).toBe("global");

    for (const scope of RegistrationDetector.scopesToEnsure(context)) {
      await sandbox.installer.install(scope, sandbox.projectDir, LOAD_INSTALL_OPTIONS);
    }

    expect(await exists(sandbox.globalManifestPath)).toBe(true);
    expect(await exists(join(sandbox.globalDir, "opencode", "skills", SKILL_NAMES[0], "SKILL.md"))).toBe(true);
    expect(await exists(join(sandbox.projectDir, ".opencode"))).toBe(false);
  });

  test("repo-local context: repo assets ensured, root file untouched", async () => {
    const rootConfig: string = join(sandbox.projectDir, "opencode.json");
    await writeConfig(rootConfig, { plugins: ["aurelia-expert@latest"] });

    const context = await RegistrationDetector.detect(sandbox.projectDir);
    expect(context).toBe("repo-local");

    for (const scope of RegistrationDetector.scopesToEnsure(context)) {
      await sandbox.installer.install(scope, sandbox.projectDir, LOAD_INSTALL_OPTIONS);
    }

    expect(await exists(sandbox.localManifestPath)).toBe(true);
    expect(await exists(rootConfig)).toBe(true);
    expect(await exists(sandbox.globalManifestPath)).toBe(false);
  });

  test("both context: legacy and v2 registrations are both detected without leakage", async () => {
    await writeConfig(sandbox.globalConfigPath, { plugin: ["aurelia-expert@1.0.0"] });
    await writeConfig(sandbox.localConfigPath, { plugins: ["aurelia-expert"] });

    const context = await RegistrationDetector.detect(sandbox.projectDir);
    expect(context).toBe("both");

    for (const scope of RegistrationDetector.scopesToEnsure(context)) {
      await sandbox.installer.install(scope, sandbox.projectDir, LOAD_INSTALL_OPTIONS);
    }

    expect(await exists(sandbox.globalManifestPath)).toBe(true);
    expect(await exists(sandbox.localManifestPath)).toBe(true);
  });

  test("none context: detection performs zero writes and scopesToEnsure is empty", async () => {
    const context = await RegistrationDetector.detect(sandbox.projectDir);
    expect(context).toBe("none");
    expect(RegistrationDetector.scopesToEnsure(context)).toEqual([]);
    expect(await exists(join(sandbox.projectDir, ".opencode"))).toBe(false);
    expect(await exists(join(sandbox.globalDir, "skills"))).toBe(false);
  });

  test("detection itself never writes anything", async () => {
    const globalBefore: string[] = await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: sandbox.globalDir }));
    await RegistrationDetector.detect(sandbox.projectDir);
    const globalAfter: string[] = await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: sandbox.globalDir }));
    expect(globalAfter).toEqual(globalBefore);
  });

  test("advisory suppressed when any scope holds an install", async () => {
    await sandbox.installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);
    expect(await RegistrationDetector.hasAnyInstallation(sandbox.projectDir)).toBe(true);
  });

  test("advisory condition met when no scope holds an install", async () => {
    expect(await RegistrationDetector.hasAnyInstallation(sandbox.projectDir)).toBe(false);
  });
});

describe("uninstall", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
    await sandbox.installer.install("local", sandbox.projectDir);
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("removes every skill directory, the manifest, and the plugins entry", async () => {
    const result = await sandbox.installer.uninstall("local", sandbox.projectDir);

    expect(result.removed.length).toBe(SKILL_NAMES.length + 1);
    for (const path of result.removed) {
      expect(await exists(path)).toBe(false);
    }
    expect(result.pluginRemoved).toBe(true);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    expect(config.plugins).toBeUndefined();
  });
});

describe("status", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("reports nothing installed in empty sandbox", async () => {
    const result = await sandbox.installer.status(sandbox.projectDir);
    expect(result.local).toBeNull();
    expect(result.global).toBeNull();
  });

  test("reports manifest-based install per scope", async () => {
    await sandbox.installer.install("local", sandbox.projectDir);
    const result = await sandbox.installer.status(sandbox.projectDir);
    expect(result.local?.installed).toBe(true);
    expect(result.local?.legacy).toBe(false);
    expect(result.local?.version).not.toBeNull();
    expect(result.local?.pluginInConfig).toBe(true);
    expect(result.global).toBeNull();
  });

  test("reports legacy pre-manifest installs with the legacy flag", async () => {
    const legacySkillDir: string = join(sandbox.projectDir, ".opencode", "skills", SKILL_NAMES[0]);
    await sandbox.installer.install("local", sandbox.projectDir);
    await rm(sandbox.localManifestPath);
    await writeFile(join(legacySkillDir, ".version"), "0.3.0");

    const result = await sandbox.installer.status(sandbox.projectDir);

    expect(result.local?.installed).toBe(true);
    expect(result.local?.legacy).toBe(true);
    expect(result.local?.version).toBe("0.3.0");
  });
});

describe("scope typing sanity", () => {
  test("scope union is global-first and exhaustive", () => {
    const scopes: readonly Scope[] = ["global", "local"];
    expect(scopes.length).toBe(2);
  });
});
