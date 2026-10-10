import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ConfigTextScanner, type ElementRegion, type MemberRegion } from "./config-text-scanner.ts";
import { ConfigWarnings } from "./config-warnings.ts";
import { JsoncParser } from "./jsonc.ts";

interface RawFileState {
  present: boolean;
  text: string | null;
}

interface TextEdit {
  start: number;
  end: number;
  replacement: string;
}

interface Insertion {
  index: number;
  text: string;
}

export class ConfigSpliceWriter {
  private readonly configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  async appendToArray(key: string, entries: readonly unknown[]): Promise<boolean> {
    const state: RawFileState = await this.readRawState();
    if (!state.present) {
      return this.writeFreshDocument(key, entries);
    }
    const text: string = state.text ?? "";
    const scanner: ConfigTextScanner = new ConfigTextScanner(text);
    const member: MemberRegion | null = scanner.findMemberValue(key, 0, text.length);
    if (member === null) {
      return this.insertNewMember(text, key, JSON.stringify(entries));
    }
    if (text[member.valueStart] !== "[") {
      ConfigWarnings.refusal(this.configPath, `"${key}" is present but is not an array.`);
      return false;
    }
    const parsedRegion: unknown = JsoncParser.parse(text.slice(member.valueStart, member.valueEnd));
    if (!Array.isArray(parsedRegion)) {
      ConfigWarnings.refusal(this.configPath, `"${key}" does not contain a readable array.`);
      return false;
    }
    const insertion: Insertion | null =
      ConfigSpliceWriter.buildArrayAppendInsertion(text, member.valueStart, member.valueEnd, entries, parsedRegion);
    if (insertion === null) {
      ConfigWarnings.refusal(this.configPath, `"${key}" ends in a comment that a splice would corrupt.`);
      return false;
    }
    return this.applyEdits(text, [{ start: insertion.index, end: insertion.index, replacement: insertion.text }]);
  }

  async removeArrayElements(
    key: string,
    shouldRemove: (entry: unknown) => Promise<boolean>,
  ): Promise<boolean> {
    const state: RawFileState = await this.readRawState();
    if (!state.present || state.text === null) {
      return false;
    }
    const text: string = state.text;
    const scanner: ConfigTextScanner = new ConfigTextScanner(text);
    const member: MemberRegion | null = scanner.findMemberValue(key, 0, text.length);
    if (member === null) {
      return false;
    }
    if (text[member.valueStart] !== "[") {
      ConfigWarnings.refusal(this.configPath, `"${key}" is present but is not an array.`);
      return false;
    }
    const parsedRegion: unknown = JsoncParser.parse(text.slice(member.valueStart, member.valueEnd));
    if (!Array.isArray(parsedRegion)) {
      ConfigWarnings.refusal(this.configPath, `"${key}" does not contain a readable array.`);
      return false;
    }
    const regions: ElementRegion[] = scanner.arrayElementRegions(member.valueStart, member.valueEnd);
    if (regions.length !== parsedRegion.length) {
      ConfigWarnings.refusal(this.configPath, `"${key}" array elements could not be mapped safely.`);
      return false;
    }
    const removalFlags: boolean[] = [];
    for (const entry of parsedRegion) {
      removalFlags.push(await shouldRemove(entry));
    }
    const removedCount: number = removalFlags.filter(flag => flag).length;
    if (removedCount === 0) {
      return false;
    }
    if (removedCount === regions.length) {
      return this.applyEdits(text, [ConfigSpliceWriter.memberRemovalEdit(text, member)]);
    }
    const edits: TextEdit[] = [];
    for (let index: number = 0; index < regions.length; index += 1) {
      if (!removalFlags[index]) {
        continue;
      }
      edits.push(ConfigSpliceWriter.elementRemovalEdit(text, regions, index));
    }
    return this.applyEdits(text, edits);
  }

  async removeMembers(path: readonly string[], memberKeys: readonly string[]): Promise<boolean> {
    const state: RawFileState = await this.readRawState();
    if (!state.present || state.text === null) {
      return false;
    }
    const text: string = state.text;
    const scanner: ConfigTextScanner = new ConfigTextScanner(text);
    let container: MemberRegion | null = { keyStart: 0, valueStart: 0, valueEnd: text.length };
    for (const segment of path) {
      if (container === null) {
        return false;
      }
      container = scanner.findMemberValue(segment, container.valueStart, container.valueEnd);
    }
    if (container === null) {
      return false;
    }
    const edits: TextEdit[] = [];
    for (const memberKey of memberKeys) {
      const member: MemberRegion | null =
        scanner.findMemberValue(memberKey, container.valueStart, container.valueEnd);
      if (member === null) {
        continue;
      }
      edits.push(ConfigSpliceWriter.memberRemovalEdit(text, member));
    }
    if (edits.length === 0) {
      return false;
    }
    return this.applyEdits(text, edits);
  }

  private async readRawState(): Promise<RawFileState> {
    try {
      return { present: true, text: await readFile(this.configPath, "utf-8") };
    } catch (error) {
      if (ConfigSpliceWriter.isFileNotFoundError(error)) {
        return { present: false, text: null };
      }
      return { present: true, text: null };
    }
  }

  private async writeFreshDocument(key: string, entries: readonly unknown[]): Promise<boolean> {
    const document: string = JSON.stringify({ [key]: entries }, null, 2);
    return this.writeText(document);
  }

  private async insertNewMember(text: string, key: string, serializedEntries: string): Promise<boolean> {
    const parsed: unknown = JsoncParser.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      ConfigWarnings.refusal(this.configPath, "the file is not a JSON object a new key can be spliced into.");
      return false;
    }
    const rootClose: number = ConfigSpliceWriter.lastNonWhitespaceIndex(text);
    if (rootClose < 0 || text[rootClose] !== "}") {
      ConfigWarnings.refusal(this.configPath, "the file does not end with a top-level object.");
      return false;
    }
    const beforeClose: number = ConfigSpliceWriter.lastNonWhitespaceIndexBefore(text, rootClose);
    if (text[beforeClose] === "{") {
      const memberText: string = `"${key}": ${serializedEntries}`;
      return this.applyEdits(text, [{ start: rootClose, end: rootClose, replacement: memberText }]);
    }
    const indent: string = ConfigSpliceWriter.lineIndentAt(text, beforeClose);
    const newline: string = text.includes("\r\n") ? "\r\n" : "\n";
    const memberText: string = `,${newline}${indent}"${key}": ${serializedEntries}`;
    return this.applyEdits(text, [{ start: beforeClose + 1, end: beforeClose + 1, replacement: memberText }]);
  }

  private static buildArrayAppendInsertion(
    text: string,
    valueStart: number,
    valueEnd: number,
    entries: readonly unknown[],
    parsedRegion: readonly unknown[],
  ): Insertion | null {
    const closeIndex: number = valueEnd - 1;
    const interior: string = text.slice(valueStart + 1, closeIndex);
    if (parsedRegion.length === 0) {
      if (interior.includes("//") || interior.includes("/*")) {
        return null;
      }
      return { index: valueStart + 1, text: entries.map(entry => JSON.stringify(entry)).join(", ") };
    }
    const lastContentRelative: number = ConfigSpliceWriter.lastNonWhitespaceIndexIn(interior);
    const lastContent: number = valueStart + 1 + lastContentRelative;
    const afterTrailingComma: boolean = text[lastContent] === ",";
    const gap: string = text.slice(lastContent + 1, closeIndex);
    if (gap.includes("//") || gap.includes("/*")) {
      return null;
    }
    const multiLine: boolean = interior.includes("\n");
    const newline: string = text.includes("\r\n") ? "\r\n" : "\n";
    const indent: string = multiLine ? ConfigSpliceWriter.lineIndentAt(text, lastContent) : "";
    let leading: string = afterTrailingComma ? "" : ",";
    let joined: string = "";
    for (const entry of entries) {
      const separator: string = multiLine ? `${leading}${newline}${indent}` : `${leading} `;
      joined += `${separator}${JSON.stringify(entry)}`;
      leading = ",";
    }
    return { index: lastContent + 1, text: joined };
  }

  private static memberRemovalEdit(text: string, member: MemberRegion): TextEdit {
    const afterValue: number = ConfigTextScanner.skipWhitespaceAndComments(text, member.valueEnd);
    if (text[afterValue] === ",") {
      const swallowStart: number = ConfigSpliceWriter.separatorStartBefore(text, member.keyStart);
      return { start: swallowStart, end: afterValue + 1, replacement: "" };
    }
    const beforeKey: number = ConfigSpliceWriter.lastNonWhitespaceIndexBefore(text, member.keyStart);
    if (beforeKey >= 0 && text[beforeKey] === ",") {
      return { start: beforeKey, end: member.valueEnd, replacement: "" };
    }
    return { start: member.keyStart, end: member.valueEnd, replacement: "" };
  }

  private static separatorStartBefore(text: string, keyStart: number): number {
    const beforeKey: number = ConfigSpliceWriter.lastNonWhitespaceIndexBefore(text, keyStart);
    if (beforeKey < 0) {
      return keyStart;
    }
    const separator: string = text.slice(beforeKey + 1, keyStart);
    if (separator.includes("//") || separator.includes("/*")) {
      return keyStart;
    }
    return beforeKey + 1;
  }

  private static elementRemovalEdit(text: string, regions: readonly ElementRegion[], index: number): TextEdit {
    const region: ElementRegion = regions[index];
    if (index + 1 < regions.length) {
      return { start: region.start, end: regions[index + 1].start, replacement: "" };
    }
    const beforeElement: number = ConfigSpliceWriter.lastNonWhitespaceIndexBefore(text, region.start);
    if (beforeElement >= 0 && text[beforeElement] === ",") {
      return { start: beforeElement, end: region.end, replacement: "" };
    }
    return { start: region.start, end: region.end, replacement: "" };
  }

  private static lastNonWhitespaceIndexIn(scope: string): number {
    for (let index: number = scope.length - 1; index >= 0; index -= 1) {
      const character: string = scope[index];
      if (character !== " " && character !== "\t" && character !== "\n" && character !== "\r") {
        return index;
      }
    }
    return -1;
  }

  private static lastNonWhitespaceIndex(text: string): number {
    return ConfigSpliceWriter.lastNonWhitespaceIndexIn(text);
  }

  private static lastNonWhitespaceIndexBefore(text: string, from: number): number {
    for (let index: number = Math.min(from, text.length) - 1; index >= 0; index -= 1) {
      const character: string = text[index];
      if (character !== " " && character !== "\t" && character !== "\n" && character !== "\r") {
        return index;
      }
    }
    return -1;
  }

  private static lineIndentAt(text: string, position: number): string {
    const bounded: number = Math.min(position, text.length);
    const lineStart: number = text.lastIndexOf("\n", Math.max(bounded - 1, 0)) + 1;
    let indentEnd: number = lineStart;
    while (indentEnd < text.length && (text[indentEnd] === " " || text[indentEnd] === "\t")) {
      indentEnd += 1;
    }
    return text.slice(lineStart, indentEnd);
  }

  private async applyEdits(text: string, edits: readonly TextEdit[]): Promise<boolean> {
    const ordered: TextEdit[] = [...edits].sort((first, second) => second.start - first.start);
    let result: string = text;
    let previousStart: number = Number.POSITIVE_INFINITY;
    for (const edit of ordered) {
      if (edit.end > previousStart) {
        ConfigWarnings.refusal(this.configPath, "the planned edits would overlap.");
        return false;
      }
      result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
      previousStart = edit.start;
    }
    return this.writeText(result);
  }

  private async writeText(content: string): Promise<boolean> {
    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, content);
    return true;
  }

  private static isFileNotFoundError(error: unknown): boolean {
    return (error as NodeJS.ErrnoException).code === "ENOENT";
  }
}
