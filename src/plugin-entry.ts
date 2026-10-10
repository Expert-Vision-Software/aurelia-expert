import { exists, lstat, readFile, realpath } from "node:fs/promises";
import { dirname, extname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PluginNameNormalizer } from "./plugin-name.ts";

export class PluginEntryResolver {
  private static readonly memoLimit: number = 100;

  private static readonly resolvedNameMemo: Map<string, string | null> = new Map();

  static async resolvesToPackage(entry: unknown, packageName: string): Promise<boolean> {
    if (typeof entry === "string") {
      return PluginEntryResolver.resolvesStringEntry(entry, packageName);
    }
    if (PluginEntryResolver.isRecord(entry)) {
      const pkg: unknown = entry["package"];
      if (typeof pkg === "string") {
        return PluginEntryResolver.resolvesToPackage(pkg, packageName);
      }
    }
    return false;
  }

  private static async resolvesStringEntry(entry: string, packageName: string): Promise<boolean> {
    if (!PluginEntryResolver.isPathLike(entry) || PluginEntryResolver.isNpmSpec(entry)) {
      return false;
    }
    const root: string | null = await PluginEntryResolver.resolveToPackageRoot(entry);
    if (root === null) {
      return false;
    }
    const name: string | null = await PluginEntryResolver.readPackageName(join(root, "package.json"));
    if (name === null) {
      return false;
    }
    return PluginNameNormalizer.matches(name, packageName);
  }

  private static isPathLike(entry: string): boolean {
    return entry.startsWith("file://")
      || entry.startsWith(".")
      || isAbsolute(entry)
      || entry.includes("/")
      || entry.includes("\\");
  }

  private static isNpmSpec(entry: string): boolean {
    if (entry.startsWith("@")) {
      return true;
    }
    const versionSeparator: number = entry.lastIndexOf("@");
    if (versionSeparator <= 0) {
      return false;
    }
    const versionPart: string = entry.slice(versionSeparator + 1);
    return versionPart.length > 0 && !versionPart.includes("/");
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private static async resolveToPackageRoot(rawEntry: string): Promise<string | null> {
    const memoKey: string = rawEntry;
    const memo: Map<string, string | null> = PluginEntryResolver.resolvedNameMemo;
    if (memo.has(memoKey)) {
      return memo.get(memoKey) ?? null;
    }
    if (memo.size >= PluginEntryResolver.memoLimit) {
      memo.clear();
    }

    let targetPath: string;
    try {
      if (rawEntry.startsWith("file://")) {
        targetPath = fileURLToPath(rawEntry);
      } else {
        targetPath = rawEntry;
      }
    } catch {
      memo.set(memoKey, null);
      return null;
    }

    try {
      targetPath = await realpath(targetPath);
    } catch {
      targetPath = targetPath;
    }
    let targetStats;
    try {
      targetStats = await lstat(targetPath);
    } catch {
      memo.set(memoKey, null);
      return null;
    }
    if (!targetStats.isFile() && !targetStats.isDirectory()) {
      memo.set(memoKey, null);
      return null;
    }

    if (targetStats.isFile()) {
      const containingRoot: string = dirname(targetPath);
      const entryName: string | null = extname(targetPath) === ".json"
        ? await PluginEntryResolver.readPackageName(targetPath)
        : null;
      if (entryName !== null) {
        memo.set(memoKey, containingRoot);
        return containingRoot;
      }
      return await PluginEntryResolver.walkUpToPackageRoot(containingRoot, memoKey, memo);
    }

    return await PluginEntryResolver.walkUpToPackageRoot(targetPath, memoKey, memo);
  }

  private static async walkUpToPackageRoot(
    startDir: string,
    memoKey: string,
    memo: Map<string, string | null>,
  ): Promise<string | null> {
    let current: string = startDir;
    let prev: string = "";
    while (current !== prev) {
      const candidate: string = join(current, "package.json");
      if (await exists(candidate)) {
        const name: string | null = await PluginEntryResolver.readPackageName(candidate);
        if (name !== null) {
          memo.set(memoKey, current);
          return current;
        }
      }
      prev = current;
      current = dirname(current);
    }
    memo.set(memoKey, null);
    return null;
  }

  private static async readPackageName(packageJsonPath: string): Promise<string | null> {
    try {
      const content: string = await readFile(packageJsonPath, "utf-8");
      const parsed: unknown = JSON.parse(content);
      if (!PluginEntryResolver.isRecord(parsed)) {
        return null;
      }
      const name: unknown = parsed["name"];
      return typeof name === "string" ? name : null;
    } catch {
      return null;
    }
  }
}
