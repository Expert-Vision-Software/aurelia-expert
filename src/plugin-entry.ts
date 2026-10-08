import { exists, lstat, readFile, realpath } from "node:fs/promises";
import { dirname, extname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PluginNameNormalizer } from "./plugin-name.ts";

const MEMO_LIMIT: number = 100;

const resolvedNameMemo: Map<string, string | null> = new Map();

function isPathLike(entry: string): boolean {
  return entry.startsWith("file://") || entry.startsWith(".") || isAbsolute(entry) || entry.includes("/") || entry.includes("\\");
}

function isNpmSpec(entry: string): boolean {
  return entry.includes("@") && !entry.startsWith("file://") && !entry.startsWith(".") && !isAbsolute(entry);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function resolveToPackageRoot(rawEntry: string): Promise<string | null> {
  const memoKey: string = rawEntry;
  if (resolvedNameMemo.has(memoKey)) {
    return resolvedNameMemo.get(memoKey) ?? null;
  }

  if (resolvedNameMemo.size >= MEMO_LIMIT) {
    resolvedNameMemo.clear();
  }

  let targetPath: string;
  try {
    if (rawEntry.startsWith("file://")) {
      targetPath = fileURLToPath(rawEntry);
    } else {
      targetPath = rawEntry;
    }
  } catch {
    resolvedNameMemo.set(memoKey, null);
    return null;
  }

  try {
    const real: string = await realpath(targetPath);
    targetPath = real;
  } catch {
    // realpath throws for non-existent paths; continue with original path for fs checks
  }

  let targetStats;
  try {
    targetStats = await lstat(targetPath);
  } catch {
    resolvedNameMemo.set(memoKey, null);
    return null;
  }
  if (!targetStats.isFile() && !targetStats.isDirectory()) {
    resolvedNameMemo.set(memoKey, null);
    return null;
  }

  let packageRoot: string;
  if (targetStats.isFile()) {
    if (extname(targetPath) === ".json") {
      try {
        const content: string = await readFile(targetPath, "utf-8");
        const pkg: { name?: unknown } = JSON.parse(content);
        if (typeof pkg.name === "string") {
          packageRoot = dirname(targetPath);
          resolvedNameMemo.set(memoKey, packageRoot);
          return packageRoot;
        }
      } catch {
        // not a valid package.json; walk up
      }
    }
    packageRoot = dirname(targetPath);
  } else {
    packageRoot = targetPath;
  }

  let current: string = packageRoot;
  let prev: string = "";
  while (current !== prev) {
    const candidate: string = join(current, "package.json");
    if (await exists(candidate)) {
      try {
        const content: string = await readFile(candidate, "utf-8");
        const pkg: { name?: unknown } = JSON.parse(content);
        if (typeof pkg.name === "string") {
          resolvedNameMemo.set(memoKey, current);
          return current;
        }
      } catch {
        // continue walking up
      }
    }
    prev = current;
    current = dirname(current);
  }

  resolvedNameMemo.set(memoKey, null);
  return null;
}

export class PluginEntryResolver {
  static async resolvesToPackage(entry: unknown, packageName: string): Promise<boolean> {
    if (typeof entry === "string") {
      if (isNpmSpec(entry)) {
        return false;
      }
      if (!isPathLike(entry)) {
        return false;
      }
      const root: string | null = await resolveToPackageRoot(entry);
      if (root === null) {
        return false;
      }
      const pkgJsonPath: string = join(root, "package.json");
      if (!(await exists(pkgJsonPath))) {
        return false;
      }
      try {
        const content: string = await readFile(pkgJsonPath, "utf-8");
        const pkg: { name?: unknown } = JSON.parse(content);
        if (typeof pkg.name !== "string") {
          return false;
        }
        return PluginNameNormalizer.matches(pkg.name, packageName);
      } catch {
        return false;
      }
    }

    if (isRecord(entry)) {
      const pkg: unknown = entry.package;
      if (typeof pkg === "string") {
        return PluginEntryResolver.resolvesToPackage(pkg, packageName);
      }
    }

    return false;
  }
}
