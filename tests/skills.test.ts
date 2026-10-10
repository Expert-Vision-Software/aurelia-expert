import { test, expect, describe } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  isOurPluginEntry,
  normalizePluginName,
} from "../src/installer.ts";
import { PluginEntryResolver } from "../src/plugin-entry.ts";
import { PluginNameNormalizer } from "../src/plugin-name.ts";

const PACKAGE_ROOT: string = join(import.meta.dir, "..");
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
const DESCRIPTION_MAX: number = 1024;
const LEADING_WORD_WINDOW: number = 120;
const FRONTMATTER_PATTERN: RegExp = /^---\n([\s\S]*?)\n---/;
const FIRST_PERSON_PATTERN: RegExp = /\b(i|me|my|mine|we|our|ours|us|you|your|yours)\b/i;
const SCALAR_LINE_PATTERN: RegExp = /^\s*([A-Za-z][\w-]*): (.+)$/;

async function loadSkillFile(skillName: string, fileName: string): Promise<string> {
  const path: string = join(PACKAGE_ROOT, "skills", skillName, fileName);
  return await readFile(path, "utf-8");
}

function extractFrontmatter(content: string): string | null {
  const match: RegExpMatchArray | null = content.match(FRONTMATTER_PATTERN);
  return match === null ? null : match[1] ?? null;
}

function parseFrontmatterRecord(frontmatter: string): Record<string, unknown> {
  return parseYaml(frontmatter) as Record<string, unknown>;
}

function readStringField(record: Record<string, unknown>, field: string): string | null {
  const value: unknown = record[field];
  return typeof value === "string" ? value : null;
}

function readMetadata(record: Record<string, unknown>): Record<string, unknown> | null {
  const value: unknown = record["metadata"];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readMetadataString(metadata: Record<string, unknown>, field: string): string | null {
  const value: unknown = metadata[field];
  return typeof value === "string" ? value : null;
}

function rawFieldLine(frontmatter: string, field: string): string | null {
  const pattern: RegExp = new RegExp(`^\\s*${field}: (.+)$`);
  for (const line of frontmatter.split("\n")) {
    if (pattern.test(line) === true) {
      return line;
    }
  }
  return null;
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

      const parsed: Record<string, unknown> = parseFrontmatterRecord(frontmatter);
      const skillName: string | null = readStringField(parsed, "name");
      expect(skillName).toBe(name);

      const description: string | null = readStringField(parsed, "description");
      expect(description).not.toBeNull();
      if (description === null) {
        return;
      }
      expect(description.length).toBeGreaterThan(0);
      expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(FIRST_PERSON_PATTERN.test(description)).toBe(false);

      const metadata: Record<string, unknown> | null = readMetadata(parsed);
      expect(metadata).not.toBeNull();
      if (metadata === null) {
        return;
      }
      const leadingWord: string | null = readMetadataString(metadata, "leading-word");
      expect(leadingWord).not.toBeNull();
      if (leadingWord === null) {
        return;
      }
      expect(
        description.slice(0, LEADING_WORD_WINDOW).toLowerCase(),
      ).toContain(leadingWord.toLowerCase());

      const license: string | null = readStringField(parsed, "license");
      expect(license).toBe("MIT");

      const compatibility: string | null = readStringField(parsed, "compatibility");
      expect(compatibility).not.toBeNull();
      expect(compatibility?.includes(",")).toBe(true);
    });

    test(`${name} frontmatter double-quotes every non-boolean scalar`, async () => {
      const content: string = await loadSkillFile(name, "SKILL.md");
      const frontmatter: string | null = extractFrontmatter(content);
      expect(frontmatter).not.toBeNull();
      if (frontmatter === null) {
        return;
      }
      expect(rawFieldLine(frontmatter, "license")).toBe('license: "MIT"');

      for (const line of frontmatter.split("\n")) {
        const scalar: RegExpMatchArray | null = line.match(SCALAR_LINE_PATTERN);
        if (scalar === null) {
          continue;
        }
        const key: string = scalar[1];
        const value: string = scalar[2];
        if (value === "true" || value === "false") {
          expect(key).toBe("focal-point");
          continue;
        }
        expect(value.startsWith('"')).toBe(true);
        expect(value.endsWith('"')).toBe(true);
      }
    });

    test(`${name} frontmatter parses as valid YAML and round-trips the description`, async () => {
      const content: string = await loadSkillFile(name, "SKILL.md");
      const frontmatter: string | null = extractFrontmatter(content);
      expect(frontmatter).not.toBeNull();
      if (frontmatter === null) {
        return;
      }
      const parsed: Record<string, unknown> = parseFrontmatterRecord(frontmatter);
      const description: string | null = readStringField(parsed, "description");
      expect(description).not.toBeNull();
      if (description === null) {
        return;
      }

      const descriptionLine: string | null = rawFieldLine(frontmatter, "description");
      expect(descriptionLine).not.toBeNull();
      if (descriptionLine === null) {
        return;
      }
      const scalar: string = descriptionLine.slice("description: ".length);
      expect(scalar.startsWith('"')).toBe(true);
      const reparsed: Record<string, unknown> = parseFrontmatterRecord(`description: ${scalar}`);
      expect(reparsed["description"]).toBe(description);

      const roundTripped: unknown = parseYaml(stringifyYaml(parsed));
      expect(roundTripped).toEqual(parsed);
    });

    test(`${name} frontmatter declares area and leading-word metadata`, async () => {
      const content: string = await loadSkillFile(name, "SKILL.md");
      const frontmatter: string | null = extractFrontmatter(content);
      expect(frontmatter).not.toBeNull();
      if (frontmatter === null) {
        return;
      }
      const metadata: Record<string, unknown> | null = readMetadata(parseFrontmatterRecord(frontmatter));
      expect(metadata).not.toBeNull();
      if (metadata === null) {
        return;
      }
      const area: string | null = readMetadataString(metadata, "area");
      expect(area).not.toBeNull();
      expect(area?.length).toBeGreaterThan(0);
      const leadingWord: string | null = readMetadataString(metadata, "leading-word");
      expect(leadingWord).not.toBeNull();
      expect(leadingWord?.length).toBeGreaterThan(0);
      const focalPoint: unknown = metadata["focal-point"];
      if (name === "aurelia-largespa") {
        expect(focalPoint).toBe(true);
      } else {
        expect(focalPoint).toBeUndefined();
      }
    });
  }

  test("aurelia-expert declares metadata.ground-truth: docs.aurelia.io", async () => {
    const content: string = await loadSkillFile("aurelia-expert", "SKILL.md");
    const frontmatter: string | null = extractFrontmatter(content);
    expect(frontmatter).not.toBeNull();
    if (frontmatter === null) {
      return;
    }
    expect(frontmatter).toMatch(/ground-truth:\s+"https:\/\/docs\.aurelia\.io"/);
    const metadata: Record<string, unknown> | null = readMetadata(parseFrontmatterRecord(frontmatter));
    expect(metadata?.["ground-truth"]).toBe("https://docs.aurelia.io");
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
      "cli.md",
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
    "aurelia-component-library": [
      "tokens.md",
      "library-layout.md",
      "component-anatomy.md",
      "greenfield.md",
      "migrate.md",
    ],
    "aurelia-plugin": [
      "plugin-anatomy.md",
      "configuration.md",
      "resources.md",
      "distribution.md",
      "extract.md",
    ],
    "aurelia-ecosystem": [
      "ssr.md",
      "fetch-client.md",
      "validation.md",
      "dialog.md",
      "state.md",
      "i18n.md",
      "forms.md",
      "testing.md",
    ],
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
  test(".opencode/opencode.json uses only v2-native keys and registers opencode-architect by name or path", async () => {
    const path: string = join(PACKAGE_ROOT, ".opencode", "opencode.json");
    const content: string = await readFile(path, "utf-8");
    const config = JSON.parse(content) as Record<string, unknown>;
    expect(config.plugin).toBeUndefined();
    expect(config.skills).toBeUndefined();
    const plugins: unknown = config.plugins;
    expect(Array.isArray(plugins)).toBe(true);
    if (!Array.isArray(plugins)) {
      return;
    }
    expect(plugins).toHaveLength(1);
    const entry: unknown = plugins[0];
    const nameForm: boolean =
      typeof entry === "string" && PluginNameNormalizer.matches(entry, "opencode-architect");
    const pathForm: boolean = nameForm
      ? false
      : await PluginEntryResolver.resolvesToPackage(entry, "opencode-architect");
    expect(nameForm || pathForm).toBe(true);
  });

  test(".agents/skills holds dev-only skills discoverable natively by the v2 host", async () => {
    const path: string = join(PACKAGE_ROOT, ".agents", "skills");
    const entries: string[] = await readdir(path);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries).toContain("writing-great-skills");
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