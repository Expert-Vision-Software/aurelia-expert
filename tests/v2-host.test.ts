import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PACKAGE_ROOT: string = join(import.meta.dir, "..");

interface PackageManifest {
  exports: Record<string, string>;
}

async function readManifest(): Promise<PackageManifest> {
  const text: string = await readFile(join(PACKAGE_ROOT, "package.json"), "utf-8");
  return JSON.parse(text) as PackageManifest;
}

describe("v2 host contract", () => {
  test("package.json declares both the root and the server entrypoints at ./index.ts", async () => {
    const manifest: PackageManifest = await readManifest();
    expect(manifest.exports["."]).toBe("./index.ts");
    expect(manifest.exports["./server"]).toBe("./index.ts");
  });

  test("the exports map stays a closed allowlist with no wildcard subpath", async () => {
    const manifest: PackageManifest = await readManifest();
    const wildcardKeys: string[] = Object.keys(manifest.exports).filter(key => key.includes("*"));
    expect(wildcardKeys).toEqual([]);
  });

  test("the entry module default-exports a Plugin.define shape with the aurelia-expert id", async () => {
    const entry = await import("../index.ts");
    expect(typeof entry.default).toBe("object");
    expect(entry.default.id).toBe("aurelia-expert");
    expect(typeof entry.default.effect).toBe("function");
  });
});
