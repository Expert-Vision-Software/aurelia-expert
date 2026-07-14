import { exists, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PluginNameNormalizer } from "./plugin-name.ts";

export type Scope = "local" | "global";

export interface InstallResult {
  scope: Scope;
  skillPaths: string[];
  configPath: string;
  migrated: boolean;
  permissionConfigured: boolean;
  pluginAdded: boolean;
}

export interface UninstallResult {
  scope: Scope;
  removed: string[];
  pluginRemoved: boolean;
}

export interface StatusResult {
  installed: boolean;
  version: string | null;
  scope: Scope | null;
  pluginInConfig: boolean;
}

const SKILL_NAMES: readonly string[] = [
  "aurelia-expert",
  "aurelia-foundation",
  "aurelia-runtime",
  "aurelia-largespa",
  "aurelia-migration",
  "aurelia-component-library",
] as const;

const PACKAGE_NAME: string = "aurelia-expert";
const VERSION_MARKER_SKILL: string = "aurelia-expert";

export class Installer {
  private readonly packageDir: string;
  private readonly normalizer: PluginNameNormalizer;

  constructor(packageDir: string = Installer.resolvePackageDir()) {
    this.packageDir = packageDir;
    this.normalizer = new PluginNameNormalizer();
  }

  private static resolvePackageDir(): string {
    return join(fileURLToPath(new URL("../", import.meta.url)));
  }

  static packageName(): string {
    return PACKAGE_NAME;
  }

  static skillNames(): readonly string[] {
    return SKILL_NAMES;
  }

  async getPackageVersion(): Promise<string> {
    const content: string = await Bun.file(join(this.packageDir, "package.json")).text();
    return JSON.parse(content).version as string;
  }

  getGlobalConfigPath(): string {
    const xdgConfig: string | undefined = process.env.XDG_CONFIG_HOME;
    if (xdgConfig !== undefined && xdgConfig.length > 0) {
      return join(xdgConfig, "opencode");
    }
    return join(homedir(), ".config", "opencode");
  }

  getLocalConfigPath(projectDir: string): string {
    return join(projectDir, ".opencode");
  }

  async install(scope: Scope, projectDir: string = process.cwd()): Promise<InstallResult> {
    const version: string = await this.getPackageVersion();
    const configBase: string = scope === "global"
      ? this.getGlobalConfigPath()
      : this.getLocalConfigPath(projectDir);

    const skillPaths: string[] = [];

    let migrated: boolean = false;
    if (scope === "local") {
      migrated = await this.migrateRootConfig(projectDir);
    }

    for (const name of SKILL_NAMES) {
      const srcSkillDir: string = join(this.packageDir, "skills", name);
      const destSkillDir: string = join(configBase, "skills", name);
      await this.copySkillTree(srcSkillDir, destSkillDir);
      skillPaths.push(destSkillDir);
      await Bun.write(join(destSkillDir, ".version"), version);
    }

    const configPath: string = join(configBase, "opencode.json");
    const permissionConfigured: boolean = await this.ensureSkillPermissions(configPath, SKILL_NAMES);
    const pluginAdded: boolean = await this.addPluginIfMissing(configPath);

    return { scope, skillPaths, configPath, migrated, permissionConfigured, pluginAdded };
  }

  async uninstall(scope: Scope, projectDir: string = process.cwd()): Promise<UninstallResult> {
    const configBase: string = scope === "global"
      ? this.getGlobalConfigPath()
      : this.getLocalConfigPath(projectDir);

    const removed: string[] = [];
    for (const name of SKILL_NAMES) {
      const skillPath: string = join(configBase, "skills", name);
      if (await exists(skillPath)) {
        await rm(skillPath, { recursive: true });
        removed.push(skillPath);
      }
    }

    const configPath: string = join(configBase, "opencode.json");
    const pluginRemoved: boolean = await this.removePluginFromConfig(configPath);

    return { scope, removed, pluginRemoved };
  }

  async status(projectDir: string = process.cwd()): Promise<StatusResult> {
    const scopes: readonly Scope[] = ["local", "global"] as const;
    for (const scope of scopes) {
      const configBase: string = scope === "global"
        ? this.getGlobalConfigPath()
        : this.getLocalConfigPath(projectDir);
      const versionMarker: string = join(
        configBase,
        "skills",
        VERSION_MARKER_SKILL,
        ".version",
      );
      const configPath: string = join(configBase, "opencode.json");

      try {
        const installedVersion: string = (await readFile(versionMarker, "utf-8")).trim();
        const pluginInConfig: boolean = await this.isPluginListed(configPath);
        return { installed: true, version: installedVersion, scope, pluginInConfig };
      } catch {
        const firstSkillPath: string = join(configBase, "skills", VERSION_MARKER_SKILL);
        if (await exists(firstSkillPath)) {
          const pluginInConfig: boolean = await this.isPluginListed(configPath);
          return { installed: true, version: null, scope, pluginInConfig };
        }
      }
    }

    return { installed: false, version: null, scope: null, pluginInConfig: false };
  }

  async isOurPluginEntry(entry: string): Promise<boolean> {
    return this.normalizer.matchesOurPackage(entry, PACKAGE_NAME);
  }

  normalizePluginName(entry: string): string {
    return PluginNameNormalizer.normalize(entry);
  }

  private async copySkillTree(src: string, dest: string): Promise<void> {
    await mkdir(dest, { recursive: true });
    for (const entry of await readdir(src, { withFileTypes: true })) {
      const srcPath: string = join(src, entry.name);
      const destPath: string = join(dest, entry.name);
      if (entry.isDirectory()) {
        await this.copySkillTree(srcPath, destPath);
      } else {
        await Bun.write(destPath, Bun.file(srcPath));
      }
    }
  }

  private async readJsonConfig(path: string): Promise<Record<string, unknown>> {
    try {
      return JSON.parse(await readFile(path, "utf-8")) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private async writeJsonConfig(path: string, config: Record<string, unknown>): Promise<void> {
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, JSON.stringify(config, null, 2));
  }

  private async ensureSkillPermissions(
    configPath: string,
    skillNames: readonly string[],
  ): Promise<boolean> {
    const config: Record<string, unknown> = await this.readJsonConfig(configPath);
    if (config.permission === undefined) {
      config.permission = {};
    }
    const permission: Record<string, unknown> = config.permission as Record<string, unknown>;
    if (permission.skill === undefined) {
      permission.skill = {};
    }
    const skillPerms: Record<string, unknown> = permission.skill as Record<string, unknown>;
    let changed: boolean = false;
    for (const name of skillNames) {
      if (skillPerms[name] !== "allow") {
        skillPerms[name] = "allow";
        changed = true;
      }
    }
    if (changed) {
      await this.writeJsonConfig(configPath, config);
    }
    return changed;
  }

  private async addPluginIfMissing(configPath: string): Promise<boolean> {
    const config: Record<string, unknown> = await this.readJsonConfig(configPath);
    const plugins: string[] = await this.collectPluginEntries(config);
    const alreadyPresent: boolean = await this.anyEntryMatches(plugins);
    if (alreadyPresent) {
      return false;
    }
    plugins.push(PACKAGE_NAME);
    config.plugin = plugins;
    await this.writeJsonConfig(configPath, config);
    return true;
  }

  private async removePluginFromConfig(configPath: string): Promise<boolean> {
    const config: Record<string, unknown> = await this.readJsonConfig(configPath);
    const plugins: string[] = await this.collectPluginEntries(config);
    const filtered: string[] = await this.filterOutOurEntries(plugins);
    if (filtered.length === plugins.length) {
      return false;
    }
    if (filtered.length === 0) {
      delete config.plugin;
    } else {
      config.plugin = filtered;
    }
    await this.writeJsonConfig(configPath, config);
    return true;
  }

  private async isPluginListed(configPath: string): Promise<boolean> {
    const config: Record<string, unknown> = await this.readJsonConfig(configPath);
    const plugins: string[] = await this.collectPluginEntries(config);
    return await this.anyEntryMatches(plugins);
  }

  private async migrateRootConfig(projectDir: string): Promise<boolean> {
    const rootConfigPath: string = join(projectDir, "opencode.json");
    const dotOpencodeConfigPath: string = join(projectDir, ".opencode", "opencode.json");
    const rootExists: boolean = await exists(rootConfigPath);
    if (!rootExists) {
      return false;
    }
    const rootConfig: Record<string, unknown> = await this.readJsonConfig(rootConfigPath);
    const dotOpencodeExists: boolean = await exists(dotOpencodeConfigPath);
    if (dotOpencodeExists) {
      const dotConfig: Record<string, unknown> = await this.readJsonConfig(dotOpencodeConfigPath);
      const merged: Record<string, unknown> = { ...rootConfig, ...dotConfig };
      await this.writeJsonConfig(dotOpencodeConfigPath, merged);
    } else {
      await mkdir(join(projectDir, ".opencode"), { recursive: true });
      await this.writeJsonConfig(dotOpencodeConfigPath, rootConfig);
    }
    await rm(rootConfigPath);
    return true;
  }

  private async collectPluginEntries(config: Record<string, unknown>): Promise<string[]> {
    const raw: unknown = config.plugin;
    if (!Array.isArray(raw)) {
      return [];
    }
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item === "string") {
        out.push(item);
      }
    }
    return out;
  }

  private async anyEntryMatches(entries: readonly string[]): Promise<boolean> {
    for (const entry of entries) {
      if (await this.isOurPluginEntry(entry)) {
        return true;
      }
    }
    return false;
  }

  private async filterOutOurEntries(entries: readonly string[]): Promise<string[]> {
    const out: string[] = [];
    for (const entry of entries) {
      if (!(await this.isOurPluginEntry(entry))) {
        out.push(entry);
      }
    }
    return out;
  }
}

export async function install(
  scope: Scope,
  projectDir: string = process.cwd(),
): Promise<InstallResult> {
  return await new Installer().install(scope, projectDir);
}

export async function uninstall(
  scope: Scope,
  projectDir: string = process.cwd(),
): Promise<UninstallResult> {
  return await new Installer().uninstall(scope, projectDir);
}

export async function status(projectDir: string = process.cwd()): Promise<StatusResult> {
  return await new Installer().status(projectDir);
}

export async function getPackageVersion(): Promise<string> {
  return await new Installer().getPackageVersion();
}

export function getGlobalConfigPath(): string {
  return new Installer().getGlobalConfigPath();
}

export function getLocalConfigPath(projectDir: string): string {
  return new Installer().getLocalConfigPath(projectDir);
}

export async function isOurPluginEntry(entry: string): Promise<boolean> {
  return await new Installer().isOurPluginEntry(entry);
}

export function normalizePluginName(entry: string): string {
  return new Installer().normalizePluginName(entry);
}