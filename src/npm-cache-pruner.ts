import { exists, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface NpmCacheFileSystem {
  keyExists(keyPath: string): Promise<boolean>;
  removeKey(keyPath: string): Promise<void>;
}

export class NodeNpmCacheFileSystem implements NpmCacheFileSystem {
  static readonly instance: NodeNpmCacheFileSystem = new NodeNpmCacheFileSystem();

  async keyExists(keyPath: string): Promise<boolean> {
    return exists(keyPath);
  }

  async removeKey(keyPath: string): Promise<void> {
    await rm(keyPath, { recursive: true, force: true });
  }
}

export class NpmCachePruner {
  private readonly packageName: string;

  private readonly version: string;

  private readonly fileSystem: NpmCacheFileSystem | null;

  constructor(packageName: string, version: string, fileSystem: NpmCacheFileSystem | null = null) {
    this.packageName = packageName;
    this.version = version;
    this.fileSystem = fileSystem;
  }

  static cacheBase(): string {
    const xdgCache: string | undefined = process.env.XDG_CACHE_HOME;
    const root: string = xdgCache !== undefined && xdgCache.length > 0
      ? xdgCache
      : join(homedir(), ".cache");
    return join(root, "opencode", "npm");
  }

  selfKeys(): string[] {
    return [
      this.packageName,
      `${this.packageName}@latest`,
      `${this.packageName}@${this.version}`,
    ];
  }

  async prune(): Promise<string[]> {
    const fileSystem: NpmCacheFileSystem = this.fileSystem ?? NodeNpmCacheFileSystem.instance;
    const removed: string[] = [];
    for (const key of this.selfKeys()) {
      const keyPath: string = join(NpmCachePruner.cacheBase(), key);
      try {
        if (!(await fileSystem.keyExists(keyPath))) {
          continue;
        }
        await fileSystem.removeKey(keyPath);
        removed.push(key);
      } catch (error) {
        const reason: string = error instanceof Error ? error.message : String(error);
        console.warn(
          `[${this.packageName}] Could not remove npm cache key ${keyPath}: ${reason}. Continuing; ` +
            `the next start re-installs the package.`,
        );
      }
    }
    return removed;
  }
}
