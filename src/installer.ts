import { copyFile, exists, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PluginNameNormalizer } from "./plugin-name.ts";
import { InstallManifest, installManifestPath, type ManifestFileEntry } from "./manifest.ts";
import { ConfigSpliceWriter, type SpliceResult } from "./config-splice-writer.ts";
import { JsoncScanner } from "./jsonc-scanner.ts";
import { MissingSkillAssetError } from "./missing-skill-asset-error.ts";

export { installManifestPath };

export type Scope = "global" | "local";

export interface InstallOptions {
  addPluginConfig: boolean;
  migrateRootConfig: boolean;
  force: boolean;
  writePermissions?: boolean;
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

export type PluginRegistration = "registered" | "unregistered" | "unknown";

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

const CONFIG_FILE_CANDIDATES: readonly string[] = ["opencode.json", "opencode.jsonc"];

export const DEFAULT_INSTALL_OPTIONS: InstallOptions = {
  addPluginConfig: true,
  migrateRootConfig: true,
  force: false,
};

export const LOAD_INSTALL_OPTIONS: InstallOptions = {
  addPluginConfig: false,
  migrateRootConfig: false,
  force: false,
  writePermissions: false,
};

interface PlannedSkillFile {
  sourcePath: string;
  relativeDest: string;
}

type RawConfigRead =
  | { status: "missing"; raw: null }
  | { status: "ok"; raw: string }
  | { status: "unparseable"; raw: string };

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
    const read: RawConfigRead = await Installer.readRawConfig(configPath);
    if (read.status !== "ok") {
      return false;
    }
    const config: unknown | null = JsoncScanner.parseLenient(read.raw);
    if (typeof config !== "object" || config === null || Array.isArray(config)) {
      return false;
    }
    const raw: unknown = (config as Record<string, unknown>).plugin;
    if (!Array.isArray(raw)) {
      return false;
    }
    return raw.some(entry => typeof entry === "string" && PluginNameNormalizer.matches(entry, packageName));
  }

  static async pluginRegistrationForBase(configBase: string, packageName: string): Promise<PluginRegistration> {
    for (const candidate of CONFIG_FILE_CANDIDATES) {
      const candidatePath: string = join(configBase, candidate);
      if (!(await exists(candidatePath))) {
        continue;
      }
      const read: RawConfigRead = await Installer.readRawConfig(candidatePath);
      if (read.status === "unparseable") {
        console.warn(
          `[${PACKAGE_NAME}] Config candidate ${candidatePath} exists but cannot be parsed; ` +
            `treating its registration state as unknown. No writes will target it. ` +
            `Fix or remove the file, then retry.`,
        );
        return "unknown";
      }
      if (await Installer.isPluginListedIn(candidatePath, packageName)) {
        return "registered";
      }
    }
    return "unregistered";
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
    const configPath: string = await this.resolveConfigPath(configBase);
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
    const plannedFiles: PlannedSkillFile[] = await this.collectSkillFiles(version);

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
    if (action !== "noop" && (options.writePermissions ?? true)) {
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
    const configPath: string = await this.resolveConfigPath(configBase);

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

  private async resolveConfigPath(configBase: string): Promise<string> {
    for (const candidate of CONFIG_FILE_CANDIDATES) {
      const candidatePath: string = join(configBase, candidate);
      if (await exists(candidatePath)) {
        return candidatePath;
      }
    }
    return join(configBase, CONFIG_FILE_CANDIDATES[0]);
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
    const pluginInConfig: boolean =
      (await Installer.pluginRegistrationForBase(configBase, PACKAGE_NAME)) === "registered";
    return { installed: true, version, legacy: !manifest.hasContents(), pluginInConfig };
  }

  private async readLegacySkillVersion(skillDir: string): Promise<string | null> {
    try {
      return (await readFile(join(skillDir, ".version"), "utf-8")).trim();
    } catch {
      return null;
    }
  }

  private async collectSkillFiles(version: string): Promise<PlannedSkillFile[]> {
    const planned: PlannedSkillFile[] = [];
    for (const name of SKILL_NAMES) {
      const skillSource: string = join(this.packageDir, "skills", name);
      planned.push(...await Installer.collectNestedFiles(skillSource, join("skills", name), version));
    }
    return planned;
  }

  private static async collectNestedFiles(
    directory: string,
    relativeBase: string,
    version: string,
  ): Promise<PlannedSkillFile[]> {
    let entries: Dirent[] | null = null;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (Installer.isFileNotFoundError(error)) {
        throw new MissingSkillAssetError({
          packageName: PACKAGE_NAME,
          version,
          missingPath: directory,
          cacheDirectory: join(homedir(), ".cache", "opencode", "packages", `${PACKAGE_NAME}@${version}`),
        });
      }
      throw error;
    }
    const planned: PlannedSkillFile[] = [];
    for (const entry of entries) {
      const nestedSource: string = join(directory, entry.name);
      const nestedDest: string = join(relativeBase, entry.name);
      if (entry.isDirectory()) {
        planned.push(...await Installer.collectNestedFiles(nestedSource, nestedDest, version));
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

  private static async readRawConfig(path: string): Promise<RawConfigRead> {
    let content: string;
    try {
      content = await readFile(path, "utf-8");
    } catch (error) {
      if (Installer.isFileNotFoundError(error)) {
        return { status: "missing", raw: null };
      }
      return { status: "unparseable", raw: "" };
    }
    if (JsoncScanner.parseLenient(content) === null) {
      return { status: "unparseable", raw: content };
    }
    return { status: "ok", raw: content };
  }

  private async writeSplicedConfig(path: string, text: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  }

  private static warnRefusedWrite(configPath: string, reason: string): void {
    console.warn(
      `[${PACKAGE_NAME}] Refusing to write ${configPath}: ${reason} The file was left unchanged.`,
    );
  }

  private async ensureSkillPermissions(
    configPath: string,
    skillNames: readonly string[],
  ): Promise<boolean> {
    const read: RawConfigRead = await Installer.readRawConfig(configPath);
    if (read.status === "unparseable") {
      Installer.warnRefusedWrite(
        configPath,
        "the file exists but is not parseable as JSON/JSONC. Fix or remove the file, then re-run install.",
      );
      return false;
    }
    if (read.status === "missing") {
      const permissionEntries: Record<string, string> = {};
      for (const name of skillNames) {
        permissionEntries[name] = "allow";
      }
      await this.writeSplicedConfig(
        configPath,
        JSON.stringify({ permission: { skill: permissionEntries } }, null, 2),
      );
      return true;
    }
    const writer: ConfigSpliceWriter = new ConfigSpliceWriter(read.raw);
    if (!writer.hasParseableSource()) {
      Installer.warnRefusedWrite(configPath, "the file exists but is not parseable as JSON/JSONC.");
      return false;
    }
    const result: SpliceResult | null = writer.addSkillPermissions(skillNames);
    if (result === null) {
      Installer.warnRefusedWrite(
        configPath,
        "the permission structure could not be located reliably in the raw text (it may be minified or use an unexpected shape).",
      );
      return false;
    }
    if (result.changed) {
      await this.writeSplicedConfig(configPath, result.text);
    }
    return result.changed;
  }

  private async addPluginIfMissing(configPath: string): Promise<boolean> {
    const read: RawConfigRead = await Installer.readRawConfig(configPath);
    if (read.status === "unparseable") {
      Installer.warnRefusedWrite(
        configPath,
        "the file exists but is not parseable as JSON/JSONC. Fix or remove the file, then re-run install.",
      );
      return false;
    }
    const canonicalEntry: string = PluginNameNormalizer.canonicalize(PACKAGE_NAME);
    if (read.status === "missing") {
      await this.writeSplicedConfig(configPath, `{\n  "plugin": [${JSON.stringify(canonicalEntry)}]\n}\n`);
      return true;
    }
    const writer: ConfigSpliceWriter = new ConfigSpliceWriter(read.raw);
    if (!writer.hasParseableSource()) {
      Installer.warnRefusedWrite(configPath, "the file exists but is not parseable as JSON/JSONC.");
      return false;
    }
    const result: SpliceResult | null = writer.addPluginEntry(PACKAGE_NAME, canonicalEntry);
    if (result === null) {
      Installer.warnRefusedWrite(
        configPath,
        "the plugin array could not be located reliably in the raw text (it may be minified or use an unexpected shape).",
      );
      return false;
    }
    if (result.changed) {
      await this.writeSplicedConfig(configPath, result.text);
    }
    return result.changed;
  }

  private async removePluginFromConfig(configPath: string): Promise<boolean> {
    const read: RawConfigRead = await Installer.readRawConfig(configPath);
    if (read.status !== "ok") {
      Installer.warnRefusedWrite(configPath, "the file is missing or is not parseable as JSON/JSONC.");
      return false;
    }
    const writer: ConfigSpliceWriter = new ConfigSpliceWriter(read.raw);
    if (!writer.hasParseableSource()) {
      Installer.warnRefusedWrite(configPath, "the file is not parseable as JSON/JSONC.");
      return false;
    }
    const result: SpliceResult | null = writer.removePluginEntries(PACKAGE_NAME);
    if (result === null) {
      Installer.warnRefusedWrite(
        configPath,
        "the plugin array could not be edited reliably in the raw text. Remove the entry manually.",
      );
      return false;
    }
    if (result.changed) {
      await this.writeSplicedConfig(configPath, result.text);
    }
    return result.changed;
  }

  private async migrateRootConfig(projectDir: string): Promise<boolean> {
    const rootConfigPath: string | null = await Installer.firstExisting([
      join(projectDir, "opencode.json"),
      join(projectDir, "opencode.jsonc"),
    ]);
    if (rootConfigPath === null) {
      return false;
    }
    const dotOpencodeConfigPath: string | null = await Installer.firstExisting([
      join(projectDir, ".opencode", "opencode.json"),
      join(projectDir, ".opencode", "opencode.jsonc"),
    ]);
    const targetConfigPath: string = dotOpencodeConfigPath ?? join(projectDir, ".opencode", "opencode.json");

    const rootParsed: Record<string, unknown> | null = await Installer.readStrictConfigObject(rootConfigPath);
    if (rootParsed === null) {
      Installer.warnRefusedWrite(
        rootConfigPath,
        `the file is missing, unparseable, or uses JSONC-only syntax (comments and trailing commas cannot survive ` +
          `a merge rewrite), so it cannot be migrated into ${targetConfigPath}.`,
      );
      return false;
    }

    let targetParsed: Record<string, unknown> = {};
    if (dotOpencodeConfigPath !== null) {
      const targetRead: Record<string, unknown> | null =
        await Installer.readStrictConfigObject(dotOpencodeConfigPath);
      if (targetRead === null) {
        Installer.warnRefusedWrite(
          rootConfigPath,
          `${dotOpencodeConfigPath} is missing, unparseable, or uses JSONC-only syntax. Both files were left unchanged.`,
        );
        return false;
      }
      targetParsed = targetRead;
    } else {
      await mkdir(join(projectDir, ".opencode"), { recursive: true });
    }
    const merged: Record<string, unknown> = { ...rootParsed, ...targetParsed };
    await this.writeSplicedConfig(targetConfigPath, JSON.stringify(merged, null, 2));
    await rm(rootConfigPath);
    return true;
  }

  private static strictParse(text: string): unknown | null {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private static async readStrictConfigObject(path: string): Promise<Record<string, unknown> | null> {
    let content: string;
    try {
      content = await readFile(path, "utf-8");
    } catch {
      return null;
    }
    const parsed: unknown = Installer.strictParse(content);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  }

  private static async firstExisting(paths: readonly string[]): Promise<string | null> {
    for (const path of paths) {
      if (await exists(path)) {
        return path;
      }
    }
    return null;
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

export async function pluginRegistrationForBase(
  configBase: string,
  packageName: string,
): Promise<PluginRegistration> {
  return Installer.pluginRegistrationForBase(configBase, packageName);
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
