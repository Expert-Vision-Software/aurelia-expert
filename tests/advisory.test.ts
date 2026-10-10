import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { exists, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { Installer, LOAD_INSTALL_OPTIONS } from "../src/installer.ts";
import { LoadFailureAdvisory } from "../src/load-failure-advisory.ts";
import { LoadInstaller } from "../src/load-installer.ts";
import { NpmCachePruner } from "../src/npm-cache-pruner.ts";

interface Sandbox {
  projectDir: string;
  globalDir: string;
  cacheDir: string;
}

async function makeSandbox(): Promise<Sandbox> {
  const tmpRoot: string = tmpdir();
  const projectDir: string = await mkdtemp(join(tmpRoot, "aurelia-advisory-project-"));
  const globalDir: string = await mkdtemp(join(tmpRoot, "aurelia-advisory-global-"));
  const cacheDir: string = await mkdtemp(join(tmpRoot, "aurelia-advisory-cache-"));
  process.env.XDG_CONFIG_HOME = globalDir;
  process.env.XDG_CACHE_HOME = cacheDir;
  return { projectDir, globalDir, cacheDir };
}

async function cleanupSandbox(sandbox: Sandbox): Promise<void> {
  for (const dir of [sandbox.projectDir, sandbox.globalDir, sandbox.cacheDir]) {
    await rm(dir, { recursive: true, force: true });
  }
  delete process.env.XDG_CONFIG_HOME;
  delete process.env.XDG_CACHE_HOME;
}

interface WarnSpy {
  mock: { calls: Array<Array<unknown>> };
}

function warnMessages(spy: WarnSpy): string[] {
  return spy.mock.calls.map(call => String(call[0]));
}

async function writePluginRegistration(base: string): Promise<void> {
  await mkdir(base, { recursive: true });
  await writeFile(
    join(base, "opencode.json"),
    JSON.stringify({ plugins: ["aurelia-expert"] }, null, 2),
  );
}

describe("load failure advisory", () => {
  test("repeated failures emit exactly one advisory", async () => {
    const advisory: LoadFailureAdvisory = new LoadFailureAdvisory(async () => "1.0.0");
    const spy = spyOn(console, "warn");
    try {
      await advisory.emit(new Error("first failure"));
      await advisory.emit(new Error("second failure"));
      expect(warnMessages(spy).length).toBe(1);
      expect(warnMessages(spy)[0]).toContain("first failure");
    } finally {
      spy.mockRestore();
    }
  });

  test("the advisory names the remediation command and the package-qualified cache key", async () => {
    const advisory: LoadFailureAdvisory = new LoadFailureAdvisory(async () => "9.9.9");
    const spy = spyOn(console, "warn");
    try {
      await advisory.emit(new Error("boom"));
      const message: string = warnMessages(spy)[0];
      expect(message).toContain("bunx aurelia-expert install --scope global");
      expect(message).toContain("$XDG_CACHE_HOME/opencode/npm/aurelia-expert@9.9.9");
    } finally {
      spy.mockRestore();
    }
  });

  test("metadata fetch failure falls back to the literal version placeholder", async () => {
    const advisory: LoadFailureAdvisory = new LoadFailureAdvisory(async () => {
      throw new Error("metadata unavailable");
    });
    const spy = spyOn(console, "warn");
    try {
      await advisory.emit(new Error("boom"));
      const message: string = warnMessages(spy)[0];
      expect(message).toContain("aurelia-expert@<version>");
      expect(message).toContain("bunx aurelia-expert install --scope global");
    } finally {
      spy.mockRestore();
    }
  });

  test("a throwing emitter still lands the static fallback", async () => {
    const advisory: LoadFailureAdvisory = new LoadFailureAdvisory(async () => "1.0.0");
    const spy = spyOn(console, "warn");
    spy.mockImplementation(() => {
      throw new Error("console broken");
    });
    try {
      await advisory.emit(new Error("boom"));
      expect(warnMessages(spy).length).toBe(1);
    } catch {
      expect(true).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("load hook failure advisory", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("repeated failing loads emit one failure advisory, independent of the install advisory flag", async () => {
    const loadInstaller: LoadInstaller = new LoadInstaller();
    const spy = spyOn(console, "warn");
    try {
      await Effect.runPromise(loadInstaller.run(sandbox.projectDir));
      const installAdvisories: string[] = warnMessages(spy).filter(message =>
        message.includes("aurelia-expert is not installed in any scope"),
      );
      expect(installAdvisories.length).toBe(1);

      const registeredBase: string = join(sandbox.projectDir, ".opencode");
      await writePluginRegistration(registeredBase);
      await mkdir(join(registeredBase, "skills", "aurelia-expert"), { recursive: true });
      await mkdir(join(registeredBase, "skills", "aurelia-expert", "SKILL.md"), { recursive: true });

      await Effect.runPromise(loadInstaller.run(sandbox.projectDir));
      await Effect.runPromise(loadInstaller.run(sandbox.projectDir));

      const failureAdvisories: string[] = warnMessages(spy).filter(message =>
        message.includes("Load-time install failed and was skipped"),
      );
      expect(failureAdvisories.length).toBe(1);
      expect(warnMessages(spy).filter(message =>
        message.includes("aurelia-expert is not installed in any scope"),
      ).length).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("missing bundled skill directory", () => {
  test("CLI install surfaces a hard error naming path, version, cache dir, and reinstall command", async () => {
    const sandbox: Sandbox = await makeSandbox();
    const brokenPackageDir: string = await mkdtemp(join(tmpdir(), "aurelia-broken-pkg-"));
    try {
      await writeFile(
        join(brokenPackageDir, "package.json"),
        JSON.stringify({ name: "aurelia-expert", version: "9.9.9" }, null, 2),
      );
      const installer: Installer = new Installer(brokenPackageDir);

      try {
        await installer.install("local", sandbox.projectDir);
        expect.unreachable();
      } catch (error) {
        const message: string = error instanceof Error ? error.message : String(error);
        const skillSource: string = join(brokenPackageDir, "skills", "aurelia-expert");
        expect(message).toContain(skillSource);
        expect(message).toContain("aurelia-expert@9.9.9");
        expect(message).toContain(join(NpmCachePruner.cacheBase(), "aurelia-expert@9.9.9"));
        expect(message).toContain("bunx aurelia-expert install --scope global");
      }
    } finally {
      await rm(brokenPackageDir, { recursive: true, force: true });
      await cleanupSandbox(sandbox);
    }
  });

  test("the load path warns through the failure advisory instead of throwing", async () => {
    const sandbox: Sandbox = await makeSandbox();
    const brokenPackageDir: string = await mkdtemp(join(tmpdir(), "aurelia-broken-pkg-"));
    try {
      await writeFile(
        join(brokenPackageDir, "package.json"),
        JSON.stringify({ name: "aurelia-expert", version: "9.9.9" }, null, 2),
      );
      const installer: Installer = new Installer(brokenPackageDir);
      let loadError: unknown = new Error("unset");
      try {
        await installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);
      } catch (error) {
        loadError = error;
      }

      const spy = spyOn(console, "warn");
      try {
        const advisory: LoadFailureAdvisory = new LoadFailureAdvisory();
        await advisory.emit(loadError);
        expect(warnMessages(spy).length).toBe(1);
        expect(warnMessages(spy)[0]).toContain("bunx aurelia-expert install --scope global");
      } finally {
        spy.mockRestore();
      }
    } finally {
      await rm(brokenPackageDir, { recursive: true, force: true });
      await cleanupSandbox(sandbox);
    }
  });
});

describe("self-only npm cache pruner", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("prunes exactly the package's own keys and keeps unrelated keys", async () => {
    const npmDir: string = join(sandbox.cacheDir, "opencode", "npm");
    for (const key of ["aurelia-expert", "aurelia-expert@latest", "aurelia-expert@1.2.3", "other-pkg@latest"]) {
      await mkdir(join(npmDir, key, "some-generation"), { recursive: true });
    }

    const removed: string[] = await new NpmCachePruner("aurelia-expert", "1.2.3").prune();

    expect(removed.sort()).toEqual(["aurelia-expert", "aurelia-expert@1.2.3", "aurelia-expert@latest"]);
    expect(await exists(join(npmDir, "aurelia-expert"))).toBe(false);
    expect(await exists(join(npmDir, "other-pkg@latest"))).toBe(true);
  });

  test("pruning is idempotent when keys are already absent", async () => {
    const removed: string[] = await new NpmCachePruner("aurelia-expert", "1.2.3").prune();
    expect(removed).toEqual([]);
  });

  test("prune warns and continues when a key cannot be inspected", async () => {
    const spy = spyOn(console, "warn");
    const brokenFileSystem = {
      keyExists: async (): Promise<boolean> => {
        throw new Error("simulated ENOTDIR");
      },
      removeKey: async (): Promise<void> => {
        throw new Error("simulated EPERM");
      },
    };

    try {
      const removed: string[] = await new NpmCachePruner("aurelia-expert", "1.2.3", brokenFileSystem).prune();
      expect(removed).toEqual([]);
      expect(warnMessages(spy).filter(message => message.includes("npm cache key")).length).toBe(3);
    } finally {
      spy.mockRestore();
    }
  });

  test("CLI-style install prunes self keys while load-style install never deletes cache", async () => {
    const installer: Installer = new Installer();
    const npmDir: string = join(sandbox.cacheDir, "opencode", "npm");
    const makeKeys = async (): Promise<void> => {
      for (const key of ["aurelia-expert", "aurelia-expert@latest", "aurelia-expert@1.0.0"]) {
        await mkdir(join(npmDir, key), { recursive: true });
      }
    };

    await makeKeys();
    await installer.install("local", sandbox.projectDir);
    expect(await exists(join(npmDir, "aurelia-expert"))).toBe(false);

    await makeKeys();
    await installer.install("local", sandbox.projectDir, LOAD_INSTALL_OPTIONS);
    expect(await exists(join(npmDir, "aurelia-expert"))).toBe(true);
    expect(await exists(join(npmDir, "aurelia-expert@latest"))).toBe(true);
  });
});
