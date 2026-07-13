import { test, expect, describe } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  isOurPluginEntry,
  normalizePluginName,
} from "../src/installer.ts";

const PACKAGE_ROOT: string = join(import.meta.dir, "..");
const SKILL_NAMES: readonly string[] = [
  "aurelia-expert",
  "aurelia-foundation",
  "aurelia-runtime",
  "aurelia-largespa",
  "aurelia-migration",
] as const;
const DESCRIPTION_MAX: number = 1024;
const FRONTMATTER_PATTERN: RegExp = /^---\n([\s\S]*?)\n---/;

async function loadSkillFile(skillName: string, fileName: string): Promise<string> {
  const path: string = join(PACKAGE_ROOT, "skills", skillName, fileName);
  return await readFile(path, "utf-8");
}

function extractFrontmatter(content: string): string | null {
  const match: RegExpMatchArray | null = content.match(FRONTMATTER_PATTERN);
  return match === null ? null : match[1] ?? null;
}

function readFrontmatterField(frontmatter: string, field: string): string | null {
  const pattern: RegExp = new RegExp(`^${field}:\\s*(.+)$`, "m");
  const match: RegExpMatchArray | null = frontmatter.match(pattern);
  if (match === null || match[1] === undefined) {
    return null;
  }
  return match[1].trim();
}

describe("bundled skills", () => {
  for (const name of SKILL_NAMES) {
    test(`${name}/SKILL.md exists and has valid frontmatter`, async () => {
      const content: string = await loadSkillFile(name, "SKILL.md");
      const frontmatter: string | null = extractFrontmatter(content);
      expect(frontmatter).not.toBeNull();
      if (frontmatter === null) {
        return;
      }

      const skillName: string | null = readFrontmatterField(frontmatter, "name");
      expect(skillName).toBe(name);

      const description: string | null = readFrontmatterField(frontmatter, "description");
      expect(description).not.toBeNull();
      if (description === null) {
        return;
      }
      expect(description.length).toBeGreaterThan(0);
      expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);

      const license: string | null = readFrontmatterField(frontmatter, "license");
      expect(license).toBe("MIT");

      const compatibility: string | null = readFrontmatterField(frontmatter, "compatibility");
      expect(compatibility).not.toBeNull();
      expect(compatibility?.includes(",")).toBe(true);
    });

    test(`${name} frontmatter parses as valid YAML with string name and description`, async () => {
      const content: string = await loadSkillFile(name, "SKILL.md");
      const frontmatter: string | null = extractFrontmatter(content);
      expect(frontmatter).not.toBeNull();
      if (frontmatter === null) {
        return;
      }
      const parsed: unknown = parseYaml(frontmatter);
      const record = parsed as Record<string, unknown>;
      expect(typeof record.name).toBe("string");
      expect(typeof record.description).toBe("string");
      expect(record.description as string).not.toContain(": ");
    });

    test(`${name} frontmatter declares area and leading-word metadata`, async () => {
      const content: string = await loadSkillFile(name, "SKILL.md");
      const frontmatter: string | null = extractFrontmatter(content);
      expect(frontmatter).not.toBeNull();
      if (frontmatter === null) {
        return;
      }
      expect(frontmatter).toMatch(/^metadata:\s*$/m);
      expect(frontmatter).toMatch(/^\s+area:\s+\S+\s*$/m);
      expect(frontmatter).toMatch(/^\s+leading-word:\s+\S+\s*$/m);
    });
  }

  test("aurelia-expert declares metadata.ground-truth: docs.aurelia.io", async () => {
    const content: string = await loadSkillFile("aurelia-expert", "SKILL.md");
    const frontmatter: string | null = extractFrontmatter(content);
    expect(frontmatter).not.toBeNull();
    if (frontmatter === null) {
      return;
    }
    expect(frontmatter).toMatch(/ground-truth:\s+https:\/\/docs\.aurelia\.io/);
  });

  test("aurelia-largespa declares metadata.focal-point: true", async () => {
    const content: string = await loadSkillFile("aurelia-largespa", "SKILL.md");
    const frontmatter: string | null = extractFrontmatter(content);
    expect(frontmatter).not.toBeNull();
    if (frontmatter === null) {
      return;
    }
    expect(frontmatter).toMatch(/^\s+focal-point:\s+true\s*$/m);
  });

  test("aurelia-expert REFERENCE.md exists and is non-empty", async () => {
    const content: string = await loadSkillFile("aurelia-expert", "REFERENCE.md");
    expect(content.length).toBeGreaterThan(0);
  });
});

describe("reference files", () => {
  const REFERENCE_FILES: Record<string, readonly string[]> = {
    "aurelia-foundation": [
      "philosophy.md",
      "quickstart.md",
      "components.md",
      "lifecycle.md",
      "ai-tooling.md",
    ],
    "aurelia-runtime": ["di.md", "routing.md", "events-tasks.md", "orchestration.md"],
    "aurelia-largespa": [
      "feature-first.md",
      "directory-layout.md",
      "feature-module.md",
      "hierarchical-agents-md.md",
      "orchestrator.md",
      "model-dto.md",
      "au-northwind-pointer.md",
    ],
    "aurelia-migration": ["v1-removals.md", "debugging.md", "performance.md", "deepwiki-protocol.md"],
  };

  for (const [skill, files] of Object.entries(REFERENCE_FILES)) {
    for (const file of files) {
      test(`${skill}/reference/${file} exists and is non-empty`, async () => {
        const content: string = await loadSkillFile(skill, `reference/${file}`);
        expect(content.length).toBeGreaterThan(0);
      });
    }
  }
});

describe("package self-config", () => {
  test(".opencode/opencode.json exists and registers skill paths", async () => {
    const path: string = join(PACKAGE_ROOT, ".opencode", "opencode.json");
    const content: string = await readFile(path, "utf-8");
    const config = JSON.parse(content) as Record<string, unknown>;
    const skills = config.skills as { paths?: unknown } | undefined;
    expect(skills).toBeDefined();
    if (skills === undefined) {
      return;
    }
    expect(Array.isArray(skills.paths)).toBe(true);
    if (!Array.isArray(skills.paths)) {
      return;
    }
    expect(skills.paths.length).toBeGreaterThan(0);
  });

  test(".opencode/opencode.json pre-allows all 5 skills", async () => {
    const path: string = join(PACKAGE_ROOT, ".opencode", "opencode.json");
    const content: string = await readFile(path, "utf-8");
    const config = JSON.parse(content) as Record<string, unknown>;
    const permission = config.permission as { skill?: Record<string, string> } | undefined;
    expect(permission).toBeDefined();
    if (permission === undefined || permission.skill === undefined) {
      return;
    }
    for (const name of SKILL_NAMES) {
      expect(permission.skill[name]).toBe("allow");
    }
  });

  test("package.json exposes the aurelia-expert CLI bin", async () => {
    const path: string = join(PACKAGE_ROOT, "package.json");
    const content: string = await readFile(path, "utf-8");
    const pkg = JSON.parse(content) as Record<string, unknown>;
    expect(pkg.name).toBe("aurelia-expert");
    const bin = pkg.bin as Record<string, string> | undefined;
    expect(bin).toBeDefined();
    expect(bin?.["aurelia-expert"]).toBe("src/cli.ts");
  });
});

describe("plugin entry normalization", () => {
  test("strips @latest and other version specs", () => {
    expect(normalizePluginName("aurelia-expert@latest")).toBe("aurelia-expert");
    expect(normalizePluginName("aurelia-expert@1.2.3")).toBe("aurelia-expert");
    expect(normalizePluginName("aurelia-expert")).toBe("aurelia-expert");
  });

  test("is case-insensitive", () => {
    expect(normalizePluginName("Aurelia-Expert")).toBe("aurelia-expert");
    expect(normalizePluginName("AURELIA-EXPERT")).toBe("aurelia-expert");
  });

  test("trims surrounding whitespace", () => {
    expect(normalizePluginName("  aurelia-expert  ")).toBe("aurelia-expert");
  });

  test("does not treat scoped package leading @ as a version separator", async () => {
    expect(normalizePluginName("@scope/pkg@1.0.0")).toBe("@scope/pkg");
    expect(normalizePluginName("@scope/pkg")).toBe("@scope/pkg");
  });

  test("isOurPluginEntry matches variants of our package", async () => {
    expect(await isOurPluginEntry("aurelia-expert")).toBe(true);
    expect(await isOurPluginEntry("aurelia-expert@latest")).toBe(true);
    expect(await isOurPluginEntry("Aurelia-Expert@2.0.0")).toBe(true);
    expect(await isOurPluginEntry("  aurelia-expert  ")).toBe(true);
  });

  test("isOurPluginEntry rejects unrelated packages", async () => {
    expect(await isOurPluginEntry("opencode-architect")).toBe(false);
    expect(await isOurPluginEntry("some-other-pkg@latest")).toBe(false);
    expect(await isOurPluginEntry("@scope/aurelia-expert")).toBe(false);
  });
});