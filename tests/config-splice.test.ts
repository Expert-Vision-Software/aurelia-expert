import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { exists, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigSpliceWriter } from "../src/config-splice-writer.ts";

interface SpliceSandbox {
  rootDir: string;
  configPath: string;
}

async function makeSandbox(): Promise<SpliceSandbox> {
  const rootDir: string = await mkdtemp(join(tmpdir(), "aurelia-splice-"));
  return { rootDir, configPath: join(rootDir, "opencode.json") };
}

async function cleanupSandbox(sandbox: SpliceSandbox): Promise<void> {
  if (await exists(sandbox.rootDir)) {
    await rm(sandbox.rootDir, { recursive: true });
  }
}

async function writeRaw(path: string, text: string): Promise<void> {
  await writeFile(path, text);
}

describe("ConfigSpliceWriter byte preservation", () => {
  let sandbox: SpliceSandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await cleanupSandbox(sandbox);
  });

  test("append preserves every byte outside the edited array in a commented config", async () => {
    const before: string = [
      '// header comment',
      '{',
      '  // plugins live below',
      '  "plugins": ["other-pkg"],',
      '  /* block */ "theme": "dark"',
      '}',
      '// trailing comment',
    ].join("\n");
    await writeRaw(sandbox.configPath, before);

    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .appendToArray("plugins", ["aurelia-expert@latest"]);

    expect(wrote).toBe(true);
    const after: string = await readFile(sandbox.configPath, "utf-8");
    const expected: string = [
      '// header comment',
      '{',
      '  // plugins live below',
      '  "plugins": ["other-pkg", "aurelia-expert@latest"],',
      '  /* block */ "theme": "dark"',
      '}',
      '// trailing comment',
    ].join("\n");
    expect(after).toBe(expected);
  });

  test("append into a pretty multi-line array matches the existing element indentation", async () => {
    const before: string = [
      '{',
      '  "theme": "dark",',
      '  "plugins": [',
      '    "other-pkg"',
      '  ]',
      '}',
    ].join("\n");
    await writeRaw(sandbox.configPath, before);

    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .appendToArray("plugins", [{ package: "aurelia-expert", options: { enabled: true } }]);

    expect(wrote).toBe(true);
    const after: string = await readFile(sandbox.configPath, "utf-8");
    const expected: string = [
      '{',
      '  "theme": "dark",',
      '  "plugins": [',
      '    "other-pkg",',
      '    {"package":"aurelia-expert","options":{"enabled":true}}',
      '  ]',
      '}',
    ].join("\n");
    expect(after).toBe(expected);
  });

  test("append after a trailing comma omits the extra separator", async () => {
    const before: string = '{\n  "plugins": [\n    "other-pkg",\n  ]\n}\n';
    await writeRaw(sandbox.configPath, before);

    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .appendToArray("plugins", ["aurelia-expert@latest"]);

    expect(wrote).toBe(true);
    const after: string = await readFile(sandbox.configPath, "utf-8");
    expect(after).toBe('{\n  "plugins": [\n    "other-pkg",\n    "aurelia-expert@latest"\n  ]\n}\n');
  });

  test("append into an empty array stays inline", async () => {
    await writeRaw(sandbox.configPath, '{"plugins": []}');

    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .appendToArray("plugins", ["aurelia-expert@latest"]);

    expect(wrote).toBe(true);
    expect(await readFile(sandbox.configPath, "utf-8")).toBe('{"plugins": ["aurelia-expert@latest"]}');
  });

  test("append inserts a brand-new member after the last existing member", async () => {
    const before: string = '{\n  "theme": "dark"\n}';
    await writeRaw(sandbox.configPath, before);

    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .appendToArray("plugins", ["aurelia-expert@latest"]);

    expect(wrote).toBe(true);
    const after: string = await readFile(sandbox.configPath, "utf-8");
    expect(after).toBe('{\n  "theme": "dark",\n  "plugins": ["aurelia-expert@latest"]\n}');
  });

  test("a missing config file is created fresh with just the target key", async () => {
    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .appendToArray("plugins", ["aurelia-expert@latest"]);

    expect(wrote).toBe(true);
    const parsed: unknown = JSON.parse(await readFile(sandbox.configPath, "utf-8"));
    expect(parsed).toEqual({ plugins: ["aurelia-expert@latest"] });
  });

  test("an unparseable config is refused and stays byte-for-byte", async () => {
    const garbage: string = "{ not json !!!";
    await writeRaw(sandbox.configPath, garbage);

    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .appendToArray("plugins", ["aurelia-expert@latest"]);

    expect(wrote).toBe(false);
    expect(await readFile(sandbox.configPath, "utf-8")).toBe(garbage);
  });

  test("a non-array target key is refused and stays byte-for-byte", async () => {
    const before: string = '{"plugins": "aurelia-expert"}';
    await writeRaw(sandbox.configPath, before);

    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .appendToArray("plugins", ["aurelia-expert@latest"]);

    expect(wrote).toBe(false);
    expect(await readFile(sandbox.configPath, "utf-8")).toBe(before);
  });

  test("removal drops an element and its separator while keeping consumer bytes", async () => {
    const before: string = [
      '{',
      '  "plugins": [',
      '    "aurelia-expert@1.0.0",',
      '    "keep-me",',
      '    "aurelia-expert"',
      '  ]',
      '}',
    ].join("\n");
    await writeRaw(sandbox.configPath, before);

    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .removeArrayElements("plugins", async entry => typeof entry === "string"
        && entry.toLowerCase().startsWith("aurelia-expert"));

    expect(wrote).toBe(true);
    expect(await readFile(sandbox.configPath, "utf-8")).toBe([
      '{',
      '  "plugins": [',
      '    "keep-me"',
      '  ]',
      '}',
    ].join("\n"));
  });

  test("removing every element drops the whole member and its separator", async () => {
    const before: string = '{\n  "theme": "dark",\n  "plugins": ["aurelia-expert"]\n}';
    await writeRaw(sandbox.configPath, before);

    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .removeArrayElements("plugins", async () => true);

    expect(wrote).toBe(true);
    expect(await readFile(sandbox.configPath, "utf-8")).toBe('{\n  "theme": "dark"\n}');
  });

  test("removeMembers deletes nested legacy records without reformatting siblings", async () => {
    const before: string = [
      '{',
      '  "permission": {',
      '    "skill": {',
      '      "aurelia-expert": "allow",',
      '      "aurelia-runtime": "allow",',
      '      "some-other-skill": "allow"',
      '    },',
      '    "bash": { "rm *": "deny" }',
      '  },',
      '  "theme": "dark"',
      '}',
    ].join("\n");
    await writeRaw(sandbox.configPath, before);

    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .removeMembers(["permission", "skill"], ["aurelia-expert", "aurelia-runtime"]);

    expect(wrote).toBe(true);
    expect(await readFile(sandbox.configPath, "utf-8")).toBe([
      '{',
      '  "permission": {',
      '    "skill": {',
      '      "some-other-skill": "allow"',
      '    },',
      '    "bash": { "rm *": "deny" }',
      '  },',
      '  "theme": "dark"',
      '}',
    ].join("\n"));
  });

  test("removeMembers removes a whole member by path", async () => {
    const before: string = '{\n  "permission": {"skill": {"aurelia-expert": "allow"}},\n  "theme": "dark"\n}';
    await writeRaw(sandbox.configPath, before);

    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .removeMembers([], ["permission"]);

    expect(wrote).toBe(true);
    expect(await readFile(sandbox.configPath, "utf-8")).toBe('{\n  "theme": "dark"\n}');
  });

  test("removal is a no-op when nothing matches and the file stays byte-for-byte", async () => {
    const before: string = '{\n  "plugins": ["keep-me"]\n}';
    await writeRaw(sandbox.configPath, before);

    const wrote: boolean = await new ConfigSpliceWriter(sandbox.configPath)
      .removeArrayElements("plugins", async () => false);

    expect(wrote).toBe(false);
    expect(await readFile(sandbox.configPath, "utf-8")).toBe(before);
  });
});
