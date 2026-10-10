import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { exists, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Installer, type PermissionRule } from "../src/installer.ts";
import { ConfigSchemaValidator } from "./config-schema-validator.ts";

const PACKAGE_ROOT: string = join(import.meta.dir, "..");
const SKILL_NAMES: readonly string[] = Installer.skillNames();

interface Sandbox {
  projectDir: string;
  globalDir: string;
  installer: Installer;
  localConfigPath: string;
}

async function makeSandbox(): Promise<Sandbox> {
  const tmpRoot: string = tmpdir();
  const projectDir: string = await mkdtemp(join(tmpRoot, "aurelia-schema-project-"));
  const globalDir: string = await mkdtemp(join(tmpRoot, "aurelia-schema-global-"));
  process.env.XDG_CONFIG_HOME = globalDir;
  process.env.XDG_CACHE_HOME = globalDir;
  return {
    projectDir,
    globalDir,
    installer: new Installer(PACKAGE_ROOT),
    localConfigPath: join(projectDir, ".opencode", "opencode.json"),
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
  delete process.env.XDG_CACHE_HOME;
}

async function writeSeedConfig(sandbox: Sandbox, value: unknown): Promise<void> {
  await mkdir(join(sandbox.projectDir, ".opencode"), { recursive: true });
  await writeFile(sandbox.localConfigPath, JSON.stringify(value, null, 2));
}

describe("installer-emitted configs decode against the pinned v2 schema", () => {
  const validator: ConfigSchemaValidator = new ConfigSchemaValidator();
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("the config created by a default-options install decodes against Config.Info", async () => {
    const result = await sandbox.installer.install("local", sandbox.projectDir);
    expect(result.permissionConfigured).toBe(true);
    expect(result.pluginAdded).toBe(true);

    const verdict = validator.validateText(await readFile(sandbox.localConfigPath, "utf-8"));
    expect(verdict.issue).toBeNull();
    expect(verdict.ok).toBe(true);
    expect(verdict.config?.plugins).toEqual(["aurelia-expert@latest"]);
    const rules: readonly PermissionRule[] = verdict.config?.permissions ?? [];
    for (const name of SKILL_NAMES) {
      expect(rules).toContainEqual({ action: "skill", resource: name, effect: "allow" });
    }
  });

  test("a default-options install into an existing v2 config keeps the whole file schema-valid", async () => {
    await writeSeedConfig(sandbox, {
      model: { providerID: "anthropic", model: "claude-sonnet-4" },
      permissions: [{ action: "shell", resource: "git push *", effect: "deny" }],
      plugins: [{ package: "other-plugin", options: { enabled: true } }],
    });

    await sandbox.installer.install("local", sandbox.projectDir);

    const verdict = validator.validateText(await readFile(sandbox.localConfigPath, "utf-8"));
    expect(verdict.issue).toBeNull();
    expect(verdict.ok).toBe(true);
    expect(verdict.config?.plugins).toHaveLength(2);
    expect(verdict.config?.permissions?.[0]).toEqual({
      action: "shell",
      resource: "git push *",
      effect: "deny",
    });
  });
});

describe("the pinned schema detects shapes the installer must never emit", () => {
  const validator: ConfigSchemaValidator = new ConfigSchemaValidator();

  test("v1 permission maps, unknown effects, and malformed plugin entries are rejected", () => {
    expect(validator.validateValue({ permissions: { bash: "allow" } }).ok).toBe(false);
    expect(
      validator.validateValue({ permissions: [{ action: "shell", resource: "*", effect: "sometimes" }] }).ok,
    ).toBe(false);
    expect(validator.validateValue({ plugins: { broken: true } }).ok).toBe(false);
    expect(validator.validateValue({ plugins: [{ package: 42 }] }).ok).toBe(false);
  });

  test("unparseable installer output is reported as an issue, never thrown", () => {
    const verdict = validator.validateText("{ not json !!!");
    expect(verdict.ok).toBe(false);
    expect(verdict.issue).toContain("not parseable");
  });
});
