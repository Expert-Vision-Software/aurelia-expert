import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { exists, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Installer,
  LOAD_INSTALL_OPTIONS,
  installManifestPath,
  type Scope,
} from "../src/installer.ts";
import { RegistrationDetector, type RegistrationContext } from "../src/registration.ts";
import { JsoncScanner } from "../src/jsonc-scanner.ts";
import { MissingSkillAssetError } from "../src/missing-skill-asset-error.ts";
import { CopyModeUnsupportedError } from "../src/copy-mode-unsupported-error.ts";
import { installCommand } from "../src/commands/install.ts";
import * as realOs from "node:os";

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

  test("fresh install copies every skill, writes permissions, manifest, and canonical plugin entry", async () => {
    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.action).toBe("installed");
    expect(result.skillPaths.length).toBe(SKILL_NAMES.length);
    for (const path of result.skillPaths) {
      expect(await exists(join(path, "SKILL.md"))).toBe(true);
      expect(await exists(join(path, ".version"))).toBe(false);
    }
    expect(await exists(sandbox.localManifestPath)).toBe(true);

    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    const permission = config.permission as { skill?: Record<string, string> };
    for (const name of SKILL_NAMES) {
      expect(permission.skill?.[name]).toBe("allow");
    }
    const plugins = config.plugin as string[];
    expect(plugins).toContain("aurelia-expert@latest");
    expect(result.pluginAdded).toBe(true);
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

describe("CLI-only behaviors at load", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("load options never add the plugin entry", async () => {
    await writeConfig(sandbox.localConfigPath, { theme: "dark" });

    await sandbox.installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);

    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
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
      { plugin: ["aurelia-expert@latest", "Aurelia-Expert", "some-other-pkg"] },
    );

    const result = await sandbox.installer.install("local", sandbox.projectDir);

    expect(result.pluginAdded).toBe(false);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    const plugins = config.plugin as string[];
    expect(plugins.filter(entry => entry.toLowerCase().startsWith("aurelia-expert")).length).toBe(2);
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
    await writeConfig(sandbox.globalConfigPath, { plugin: ["aurelia-expert"] });

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
    await writeConfig(rootConfig, { plugin: ["aurelia-expert@latest"] });

    const context = await RegistrationDetector.detect(sandbox.projectDir);
    expect(context).toBe("repo-local");

    for (const scope of RegistrationDetector.scopesToEnsure(context)) {
      await sandbox.installer.install(scope, sandbox.projectDir, LOAD_INSTALL_OPTIONS);
    }

    expect(await exists(sandbox.localManifestPath)).toBe(true);
    expect(await exists(rootConfig)).toBe(true);
    expect(await exists(sandbox.globalManifestPath)).toBe(false);
  });

  test("both context: both scopes ensured without leakage", async () => {
    await writeConfig(sandbox.globalConfigPath, { plugin: ["aurelia-expert@1.0.0"] });
    await writeConfig(sandbox.localConfigPath, { plugin: ["aurelia-expert"] });

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

  test("removes every skill directory, the manifest, and the plugin entry", async () => {
    const result = await sandbox.installer.uninstall("local", sandbox.projectDir);

    expect(result.removed.length).toBe(SKILL_NAMES.length + 1);
    for (const path of result.removed) {
      expect(await exists(path)).toBe(false);
    }
    expect(result.pluginRemoved).toBe(true);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    expect(config.plugin).toBeUndefined();
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

function captureConsoleWarn(): { warnings: string[]; restore: () => void } {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
  return { warnings, restore: () => { console.warn = original; } };
}

describe("jsonc config detection and splicing", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("plugin registered in .opencode/opencode.jsonc with comments and trailing comma is detected", async () => {
    const jsoncPath: string = join(sandbox.projectDir, ".opencode", "opencode.jsonc");
    await writeRawConfig(
      jsoncPath,
      [
        "{",
        "  // editor theme chosen by the team",
        '  "theme": "dark",',
        '  "plugin": [',
        '    "some-other-pkg",',
        '    "aurelia-expert@latest",',
        "  ],",
        "}",
        "",
      ].join("\n"),
    );

    const registration = await Installer.pluginRegistrationForBase(
      sandbox.installer.getLocalConfigPath(sandbox.projectDir),
      "aurelia-expert",
    );
    expect(registration).toBe("registered");

    const context = await RegistrationDetector.detect(sandbox.projectDir);
    expect(context).toBe("repo-local");
  });

  test("splicing aurelia-expert into a jsonc config preserves comments byte-wise around the splice", async () => {
    const jsoncPath: string = join(sandbox.projectDir, ".opencode", "opencode.jsonc");
    const before: string = [
      "{",
      "  // editor theme chosen by the team",
      '  "theme": "dark",',
      '  "plugin": [ "some-other-pkg" ], // plugin list',
      '  "permission": { "skill": { "aurelia-expert": "allow" } }',
      "}",
      "",
    ].join("\n");
    await writeRawConfig(jsoncPath, before);

    await sandbox.installer.install("local", sandbox.projectDir, {
      addPluginConfig: true,
      migrateRootConfig: false,
      force: false,
    });

    const after: string = await readFile(jsoncPath, "utf-8");
    expect(after).toContain("// editor theme chosen by the team");
    expect(after).toContain("// plugin list");
    expect(after).toContain('"theme": "dark"');
    expect(after).toContain('"some-other-pkg"');

    const parsed: unknown | null = JsoncScanner.parseLenient(after);
    expect(parsed).not.toBeNull();
    const config = parsed as Record<string, unknown>;
    expect(config.theme).toBe("dark");
    expect(config.plugin).toEqual(["some-other-pkg", "aurelia-expert@latest"]);
    const permission = config.permission as { skill: Record<string, string> };
    for (const name of SKILL_NAMES) {
      expect(permission.skill[name]).toBe("allow");
    }
  });

  test("spliced bytes outside the inserted spans are unchanged (1-space indent, inline object)", async () => {
    const configPath: string = join(sandbox.projectDir, ".opencode", "opencode.json");
    const remainingSkills: readonly string[] = SKILL_NAMES.filter(name => name !== "aurelia-expert");
    const appendedPermissions: string = remainingSkills
      .map(name => `"${name}": "allow"`)
      .join(", ");
    const before: string = [
      "{",
      ' "theme": "dark",',
      ' "plugin": [ "some-other-pkg" ],',
      ' "permission": { "skill": { "aurelia-expert": "allow" } }',
      "}",
      "",
    ].join("\n");
    const expected: string = before
      .replace(
        '[ "some-other-pkg" ],',
        '[ "some-other-pkg", "aurelia-expert@latest" ],',
      )
      .replace(
        '{ "aurelia-expert": "allow" }',
        `{ "aurelia-expert": "allow", ${appendedPermissions} }`,
      );
    await writeRawConfig(configPath, before);

    await sandbox.installer.install("local", sandbox.projectDir, {
      addPluginConfig: true,
      migrateRootConfig: false,
      force: false,
    });

    const after: string = await readFile(configPath, "utf-8");
    expect(after).toBe(expected);
  });
});

describe("unparseable candidate configs", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("unparseable repo config yields unknown context, zero writes, and a warning", async () => {
    const garbage: string = "{ not json !!!";
    await writeRawConfig(sandbox.localConfigPath, garbage);
    const capture = captureConsoleWarn();

    let context: RegistrationContext | null = null;
    try {
      context = await RegistrationDetector.detect(sandbox.projectDir);
    } finally {
      capture.restore();
    }

    expect(context).toBe("unknown");
    expect(RegistrationDetector.scopesToEnsure(context)).toEqual([]);
    expect(capture.warnings.some(w => w.includes(sandbox.localConfigPath) && w.includes("unknown"))).toBe(true);
    expect(await readFile(sandbox.localConfigPath, "utf-8")).toBe(garbage);
    expect(await exists(sandbox.localManifestPath)).toBe(false);
    expect(await exists(join(sandbox.projectDir, ".opencode", "skills"))).toBe(false);
  });
});

describe("missing bundled skill assets", () => {
  test("install from a package dir without skills throws MissingSkillAssetError with remediation", async () => {
    const sandbox = await makeSandbox();
    try {
      const brokenPackageDir: string = join(sandbox.projectDir, "broken-package");
      await mkdir(brokenPackageDir, { recursive: true });
      await writeRawConfig(join(brokenPackageDir, "package.json"), '{"name":"aurelia-expert","version":"9.9.9"}');

      const broken = new Installer(brokenPackageDir);

      let thrown: unknown = null;
      try {
        await broken.install("local", sandbox.projectDir);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(MissingSkillAssetError);
      const message: string = thrown instanceof Error ? thrown.message : "";
      expect(message).toContain("aurelia-expert@9.9.9");
      expect(message).toContain(join(brokenPackageDir, "skills", "aurelia-expert"));
      expect(message).toContain(join("aurelia-expert@9.9.9"));
      expect(message).toContain("clear-cache");
      expect(message).toContain("install --scope global");
    } finally {
      await cleanupSandbox(sandbox);
    }
  });
});

describe("load-path write suppression", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("load options write skills but never permissions or plugin entries", async () => {
    const configText: string = JSON.stringify({ theme: "dark" }, null, 2) + "\n";
    await writeRawConfig(sandbox.localConfigPath, configText);

    const result = await sandbox.installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);

    expect(result.action).toBe("installed");
    expect(result.permissionConfigured).toBe(false);
    expect(result.pluginAdded).toBe(false);
    expect(await readFile(sandbox.localConfigPath, "utf-8")).toBe(configText);
    const config: Record<string, unknown> = await readConfig(sandbox.localConfigPath);
    expect(config.permission).toBeUndefined();
    expect(config.plugin).toBeUndefined();
  });

  test("load options leave permissions untouched when files change and trigger an upgrade", async () => {
    await sandbox.installer.install("local", sandbox.projectDir);
    const configBefore: string = await readFile(sandbox.localConfigPath, "utf-8");
    const skillFile: string = join(sandbox.projectDir, ".opencode", "skills", SKILL_NAMES[0], "SKILL.md");
    await writeFile(skillFile, "consumer edit");
    const manifest: Record<string, unknown> = await readConfig(sandbox.localManifestPath);
    manifest.version = "0.0.1";
    await writeFile(sandbox.localManifestPath, JSON.stringify(manifest, null, 2));

    const result = await sandbox.installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);

    expect(result.action).toBe("upgraded");
    expect(result.permissionConfigured).toBe(false);
    expect(result.pluginAdded).toBe(false);
    expect(await readFile(sandbox.localConfigPath, "utf-8")).toBe(configBefore);
  });
});

describe("copy mode and cache clearing", () => {
  test("--mode copy rejects with CopyModeUnsupportedError before touching the filesystem", async () => {
    let thrown: unknown = null;
    try {
      await installCommand({ scope: null, force: false, migrateRootConfig: false, mode: "copy" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CopyModeUnsupportedError);
    expect((thrown as Error).message).toContain("--mode copy");
  });

  test("clear-cache removes current-version and @latest cache dirs, keeps stale versions", async () => {
    const fakeHome: string = await mkdtemp(join(tmpdir(), "aurelia-test-home-"));
    mock.module("node:os", () => ({ ...realOs, homedir: () => fakeHome }));
    try {
      const { PackageCacheCleaner } = await import("../src/package-cache-cleaner.ts");
      const packagesDir: string = join(fakeHome, ".cache", "opencode", "packages");
      const version: string = JSON.parse(await readFile(join(PACKAGE_ROOT, "package.json"), "utf-8")).version;
      const currentDir: string = join(packagesDir, `aurelia-expert@${version}`);
      const latestDir: string = join(packagesDir, "aurelia-expert@latest");
      const staleDir: string = join(packagesDir, "aurelia-expert@0.0.1");
      const foreignDir: string = join(packagesDir, "other-pkg@latest");
      for (const dir of [currentDir, latestDir, staleDir, foreignDir]) {
        await mkdir(join(dir, "node_modules"), { recursive: true });
        await writeFile(join(dir, "package.json"), "{}");
      }

      const cleaner = new PackageCacheCleaner();
      const result = await cleaner.clear();

      expect(result.removedDirs).toContain(currentDir);
      expect(result.removedDirs).toContain(latestDir);
      expect(result.removedDirs.length).toBe(2);
      expect(await exists(currentDir)).toBe(false);
      expect(await exists(latestDir)).toBe(false);
      expect(await exists(staleDir)).toBe(true);
      expect(await exists(foreignDir)).toBe(true);
    } finally {
      mock.module("node:os", () => realOs);
      await rm(fakeHome, { recursive: true, force: true });
    }
  });
});
