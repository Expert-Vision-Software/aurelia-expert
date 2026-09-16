import { copyFile, exists, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PluginNameNormalizer } from "./plugin-name.ts";
import { InstallManifest, installManifestPath, type ManifestFileEntry } from "./manifest.ts";

export { installManifestPath };

export type Scope = "global" | "local";

export interface InstallOptions {
  addPluginConfig: boolean;
  migrateRootConfig: boolean;
  force: boolean;
}

export type InstallAction = "installed" | "upgraded" | "noop";

export interface InstallResult {
  action: InstallAction;
  scope: Scope;
  skillPaths: string[];
  configPath: string;
  manifestPath: string;
  skipped: string[];
  migrated: boolean;
  permissionConfigured: boolean;
  pluginAdded: boolean;
}

export interface UninstallResult {
  scope: Scope;
  removed: string[];
  pluginRemoved: boolean;
}

export interface ScopeStatus {
  installed: boolean;
  version: string | null;
  legacy: boolean;
  pluginInConfig: boolean;
}

export interface StatusResult {
  local: ScopeStatus | null;
  global: ScopeStatus | null;
}

const SKILL_NAMES: readonly string[] = [
  "aurelia-expert",
  "aurelia-foundation",
  "aurelia-runtime",
  "aurelia-largespa",
  "aurelia-migration",
  "aurelia-component-library",
  "aurelia-plugin",
  "aurelia-ecosystem",
] as const;

const PACKAGE_NAME: string = "aurelia-expert";

export const DEFAULT_INSTALL_OPTIONS: InstallOptions = {
  addPluginConfig: true,
  migrateRootConfig: true,
  force: false,
};

export const LOAD_INSTALL_OPTIONS: InstallOptions = {
  addPluginConfig: false,
  migrateRootConfig: false,
  force: false,
};

interface PlannedSkillFile {
  sourcePath: string;
  relativeDest: string;
}

export class Installer {
  private readonly packageDir: string;

  constructor(packageDir: string = Installer.resolvePackageDir()) {
    this.packageDir = packageDir;
  }

  private static resolvePackageDir(): string {
    return join(fileURLToPath(new URL("../", import.meta.url)));
  }

  static packageName(): string {
    return PACKAGE_NAME;
  }

  static async isPluginListedIn(configPath: string, packageName: string): Promise<boolean> {
    const config: Record<string, unknown> | null = await new Installer().readJsonConfig(configPath);
    if (config === null) {
      return false;
    }
    const raw: unknown = config.plugin;
    if (!Array.isArray(raw)) {
      return false;
    }
    return raw.some(entry => typeof entry === "string" && PluginNameNormalizer.matches(entry, packageName));
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

  async install(
    scope: Scope,
    projectDir: string = process.cwd(),
    options: InstallOptions = DEFAULT_INSTALL_OPTIONS,
  ): Promise<InstallResult> {
    const version: string = await this.getPackageVersion();
    const configBase: string = scope === "global"
      ? this.getGlobalConfigPath()
      : this.getLocalConfigPath(projectDir);
    const configPath: string = join(configBase, "opencode.json");
    const manifestPath: string = installManifestPath(configBase, PACKAGE_NAME);

    let migrated: boolean = false;
    if (scope === "local" && options.migrateRootConfig) {
      migrated = await this.migrateRootConfig(projectDir);
    }

    const manifest: InstallManifest = await InstallManifest.read(manifestPath);
    if (manifest.isUnreadable() && !options.force) {
      console.warn(
        `[${PACKAGE_NAME}] Install manifest at ${manifestPath} is present but unreadable; ` +
          `refusing to overwrite installed files without verification. Re-run ` +
          `"bunx ${PACKAGE_NAME} install --force" to rebuild it. Nothing was changed.`,
      );
      return {
        action: "noop",
        scope,
        skillPaths: [],
        configPath,
        manifestPath,
        skipped: [],
        migrated,
        permissionConfigured: false,
        pluginAdded: false,
      };
    }
    const sameVersion: boolean = manifest.matchesVersion(version);
    const plannedFiles: PlannedSkillFile[] = await this.collectSkillFiles();

    const writtenRelativePaths: string[] = [];
    const skipped: string[] = [];
    const recordedFiles: ManifestFileEntry[] = [];

    for (const plannedFile of plannedFiles) {
      const manifestEntryPath: string = Installer.toManifestPath(plannedFile.relativeDest);
      const verdict: string = await manifest.disposition(configBase, plannedFile.relativeDest, sameVersion, options.force);

      if (verdict === "skip") {
        skipped.push(manifestEntryPath);
        const recorded: string | null = manifest.recordedHash(plannedFile.relativeDest);
        if (recorded === null) {
          throw new Error(`Manifest disposition required a recorded hash for: ${plannedFile.relativeDest}`);
        }
        recordedFiles.push({ path: manifestEntryPath, hash: recorded });
        continue;
      }

      const installedPath: string = join(configBase, plannedFile.relativeDest);

      if (verdict === "keep") {
        const recorded: string | null = manifest.recordedHash(plannedFile.relativeDest);
        if (recorded === null) {
          throw new Error(`Manifest disposition required a recorded hash for: ${plannedFile.relativeDest}`);
        }
        recordedFiles.push({ path: manifestEntryPath, hash: recorded });
        continue;
      }

      await mkdir(dirname(installedPath), { recursive: true });
      await copyFile(plannedFile.sourcePath, installedPath);
      const installedHash: string | null = await InstallManifest.hashFile(installedPath);
      if (installedHash === null) {
        throw new Error(`Failed to hash installed file: ${installedPath}`);
      }
      recordedFiles.push({ path: manifestEntryPath, hash: installedHash });
      writtenRelativePaths.push(plannedFile.relativeDest);
    }

    const action: InstallAction =
      writtenRelativePaths.length === 0 ? "noop" : manifest.hasContents() ? "upgraded" : "installed";

    if (action !== "noop") {
      await this.removeStaleVersionMarkers(join(configBase, "skills"));
      await InstallManifest.write(manifestPath, version, recordedFiles);
    }

    let permissionConfigured: boolean = false;
    if (action !== "noop") {
      permissionConfigured = await this.ensureSkillPermissions(configPath, SKILL_NAMES);
    }

    let pluginAdded: boolean = false;
    if (options.addPluginConfig) {
      pluginAdded = await this.addPluginIfMissing(configPath);
    }

    return {
      action,
      scope,
      skillPaths: Installer.writtenSkillDirs(configBase, writtenRelativePaths),
      configPath,
      manifestPath,
      skipped,
      migrated,
      permissionConfigured,
      pluginAdded,
    };
  }

  async uninstall(scope: Scope, projectDir: string = process.cwd()): Promise<UninstallResult> {
    const configBase: string = scope === "global"
      ? this.getGlobalConfigPath()
      : this.getLocalConfigPath(projectDir);
    const configPath: string = join(configBase, "opencode.json");

    const removed: string[] = [];
    for (const name of SKILL_NAMES) {
      const skillPath: string = join(configBase, "skills", name);
      if (await exists(skillPath)) {
        await rm(skillPath, { recursive: true });
        removed.push(skillPath);
      }
    }

    const manifestPath: string = installManifestPath(configBase, PACKAGE_NAME);
    if (await exists(manifestPath)) {
      await rm(manifestPath);
      removed.push(manifestPath);
    }

    let pluginRemoved: boolean = false;
    if (await exists(configPath)) {
      pluginRemoved = await this.removePluginFromConfig(configPath);
    }

    return { scope, removed, pluginRemoved };
  }

  async status(projectDir: string = process.cwd()): Promise<StatusResult> {
    return {
      local: await this.readScopeStatus(this.getLocalConfigPath(projectDir)),
      global: await this.readScopeStatus(this.getGlobalConfigPath()),
    };
  }

  async isOurPluginEntry(entry: string): Promise<boolean> {
    return PluginNameNormalizer.matches(entry, PACKAGE_NAME);
  }

  normalizePluginName(entry: string): string {
    return PluginNameNormalizer.normalize(entry);
  }

  private async readScopeStatus(configBase: string): Promise<ScopeStatus | null> {
    const manifest: InstallManifest = await InstallManifest.read(installManifestPath(configBase, PACKAGE_NAME));
    const legacySkillDir: string = join(configBase, "skills", SKILL_NAMES[0]);
    if (!manifest.hasContents() && !(await exists(legacySkillDir))) {
      return null;
    }
    const version: string | null = manifest.hasContents()
      ? manifest.version
      : await this.readLegacySkillVersion(legacySkillDir);
    const pluginInConfig: boolean = await this.isPluginListed(join(configBase, "opencode.json"));
    return { installed: true, version, legacy: !manifest.hasContents(), pluginInConfig };
  }

  private async readLegacySkillVersion(skillDir: string): Promise<string | null> {
    try {
      return (await readFile(join(skillDir, ".version"), "utf-8")).trim();
    } catch {
      return null;
    }
  }

  private async collectSkillFiles(): Promise<PlannedSkillFile[]> {
    const planned: PlannedSkillFile[] = [];
    for (const name of SKILL_NAMES) {
      const skillSource: string = join(this.packageDir, "skills", name);
      planned.push(...await Installer.collectNestedFiles(skillSource, join("skills", name)));
    }
    return planned;
  }

  private static async collectNestedFiles(directory: string, relativeBase: string): Promise<PlannedSkillFile[]> {
    const planned: PlannedSkillFile[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const nestedSource: string = join(directory, entry.name);
      const nestedDest: string = join(relativeBase, entry.name);
      if (entry.isDirectory()) {
        planned.push(...await Installer.collectNestedFiles(nestedSource, nestedDest));
      } else {
        planned.push({ sourcePath: nestedSource, relativeDest: nestedDest });
      }
    }
    return planned;
  }

  private async removeStaleVersionMarkers(skillsBase: string): Promise<void> {
    if (!(await exists(skillsBase))) {
      return;
    }
    for (const entry of await readdir(skillsBase, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const markerPath: string = join(skillsBase, entry.name, ".version");
      if (await exists(markerPath)) {
        await rm(markerPath);
      }
    }
  }

  private static toManifestPath(relativePath: string): string {
    return relativePath.replaceAll("\\", "/");
  }

  private static writtenSkillDirs(configBase: string, writtenRelativePaths: string[]): string[] {
    const dirs: Set<string> = new Set();
    for (const relativePath of writtenRelativePaths) {
      const manifestPath: string = Installer.toManifestPath(relativePath);
      if (!manifestPath.startsWith("skills/")) {
        continue;
      }
      const skillName: string = manifestPath.slice("skills/".length).split("/")[0];
      dirs.add(join(configBase, "skills", skillName));
    }
    return [...dirs];
  }

  private static isFileNotFoundError(error: unknown): boolean {
    return (error as NodeJS.ErrnoException).code === "ENOENT";
  }

  private async readJsonConfig(path: string): Promise<Record<string, unknown> | null> {
    let content: string;
    try {
      content = await readFile(path, "utf-8");
    } catch (error) {
      if (Installer.isFileNotFoundError(error)) {
        return {};
      }
      return null;
    }
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
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
    const config: Record<string, unknown> | null = await this.readJsonConfig(configPath);
    if (config === null) {
      console.warn(
        `[${PACKAGE_NAME}] Refusing to write ${configPath}: the file is not valid JSON. ` +
          `Fix or remove the file, then re-run install. The file was left unchanged.`,
      );
      return false;
    }
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
    const config: Record<string, unknown> | null = await this.readJsonConfig(configPath);
    if (config === null) {
      console.warn(
        `[${PACKAGE_NAME}] Refusing to write ${configPath}: the file is not valid JSON. ` +
          `Fix or remove the file, then re-run install. The file was left unchanged.`,
      );
      return false;
    }
    const plugins: string[] = await this.collectPluginEntries(config);
    if (await this.anyEntryMatches(plugins)) {
      return false;
    }
    plugins.push(PluginNameNormalizer.canonicalize(PACKAGE_NAME));
    config.plugin = plugins;
    await this.writeJsonConfig(configPath, config);
    return true;
  }

  private async removePluginFromConfig(configPath: string): Promise<boolean> {
    const config: Record<string, unknown> | null = await this.readJsonConfig(configPath);
    if (config === null) {
      console.warn(
        `[${PACKAGE_NAME}] Refusing to write ${configPath}: the file is not valid JSON. ` +
          `Fix or remove the file manually. The file was left unchanged.`,
      );
      return false;
    }
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
    const config: Record<string, unknown> | null = await this.readJsonConfig(configPath);
    if (config === null) {
      return false;
    }
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
    const rootConfig: Record<string, unknown> | null = await this.readJsonConfig(rootConfigPath);
    if (rootConfig === null) {
      console.warn(
        `[${PACKAGE_NAME}] Refusing to migrate ${rootConfigPath}: the file is not valid JSON. ` +
          `Fix or remove the file, then re-run install. The file was left unchanged.`,
      );
      return false;
    }
    const dotOpencodeExists: boolean = await exists(dotOpencodeConfigPath);
    if (dotOpencodeExists) {
      const dotConfig: Record<string, unknown> | null = await this.readJsonConfig(dotOpencodeConfigPath);
      if (dotConfig === null) {
        console.warn(
          `[${PACKAGE_NAME}] Refusing to migrate ${rootConfigPath}: ${dotOpencodeConfigPath} is not valid JSON. ` +
            `Both files were left unchanged.`,
        );
        return false;
      }
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
  options: InstallOptions = DEFAULT_INSTALL_OPTIONS,
): Promise<InstallResult> {
  return await new Installer().install(scope, projectDir, options);
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

export async function getPackageName(): Promise<string> {
  return Installer.packageName();
}

export function getGlobalConfigPath(): string {
  return new Installer().getGlobalConfigPath();
}

export function getLocalConfigPath(projectDir: string): string {
  return new Installer().getLocalConfigPath(projectDir);
}

export async function isPluginInConfig(configPath: string, packageName: string): Promise<boolean> {
  return Installer.isPluginListedIn(configPath, packageName);
}

export async function isScopeInstalled(configBase: string): Promise<boolean> {
  const manifest: InstallManifest = await InstallManifest.read(installManifestPath(configBase, PACKAGE_NAME));
  if (manifest.hasContents()) {
    return true;
  }
  return exists(join(configBase, "skills", SKILL_NAMES[0]));
}

export async function isOurPluginEntry(entry: string): Promise<boolean> {
  return new Installer().isOurPluginEntry(entry);
}

export function normalizePluginName(entry: string): string {
  return new Installer().normalizePluginName(entry);
}
