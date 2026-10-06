import { join } from "node:path";
import { homedir } from "node:os";
import { readdir, rm } from "node:fs/promises";
import { getPackageName, getPackageVersion } from "./installer.ts";

export interface ClearCacheResult {
  removedDirs: Array<string>;
}

export class PackageCacheCleaner {
  async clear(): Promise<ClearCacheResult> {
    const [packageName, packageVersion] = await Promise.all([getPackageName(), getPackageVersion()]);
    const packagesDir: string = this.packagesDir();
    let entries: Array<string>;
    try {
      entries = await readdir(packagesDir);
    } catch {
      return { removedDirs: [] };
    }

    const prefix: string = `${packageName}@`;
    const removedDirs: Array<string> = [];
    for (const entry of entries) {
      if (!entry.startsWith(prefix)) {
        continue;
      }
      const isCurrent: boolean = entry === `${packageName}@${packageVersion}`;
      const isStaleLatest: boolean = entry === `${packageName}@latest`;
      if (!isCurrent && !isStaleLatest) {
        continue;
      }
      const dirPath: string = join(packagesDir, entry);
      try {
        await rm(dirPath, { recursive: true, force: true });
        removedDirs.push(dirPath);
      } catch {
        continue;
      }
    }
    return { removedDirs };
  }

  private packagesDir(): string {
    return join(homedir(), ".cache", "opencode", "packages");
  }
}
