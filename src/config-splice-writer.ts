import { PluginNameNormalizer } from "./plugin-name.ts";
import { JsoncScanner, type JsonArrayElementSpan, type JsonMemberSpan } from "./jsonc-scanner.ts";

export interface SpliceResult {
  text: string;
  changed: boolean;
}

export class ConfigSpliceWriter {
  private readonly text: string;
  private readonly scanner: JsoncScanner;
  private readonly originalParsed: unknown | null;

  constructor(text: string) {
    this.text = text;
    this.scanner = new JsoncScanner(text);
    this.originalParsed = JsoncScanner.parseLenient(text);
  }

  hasParseableSource(): boolean {
    return this.originalParsed !== null;
  }

  addPluginEntry(packageName: string, canonicalEntry: string): SpliceResult | null {
    const root: number = this.scanner.rootObjectStart();
    if (root < 0) {
      return null;
    }
    const member: JsonMemberSpan | null = this.scanner.findMember(root, "plugin");
    if (member === null) {
      const inserted: string | null = this.insertRootMember(
        `"plugin": [${JSON.stringify(canonicalEntry)}]`,
        root,
      );
      return inserted === null ? null : this.verified(inserted, true);
    }
    if (member.valueKind !== "array") {
      return null;
    }
    const elements: JsonArrayElementSpan[] | null = this.scanner.arrayElements(member.valueStart);
    if (elements === null) {
      return null;
    }
    for (const element of elements) {
      if (element.stringValue !== null && PluginNameNormalizer.matches(element.stringValue, packageName)) {
        return { text: this.text, changed: false };
      }
    }
    const appended: string | null = this.appendToArray(elements, member.valueEnd, JSON.stringify(canonicalEntry));
    return appended === null ? null : this.verified(appended, true);
  }

  removePluginEntries(packageName: string): SpliceResult | null {
    const root: number = this.scanner.rootObjectStart();
    if (root < 0) {
      return null;
    }
    const member: JsonMemberSpan | null = this.scanner.findMember(root, "plugin");
    if (member === null || member.valueKind !== "array") {
      return { text: this.text, changed: false };
    }
    const elements: JsonArrayElementSpan[] | null = this.scanner.arrayElements(member.valueStart);
    if (elements === null) {
      return null;
    }
    const matching: JsonArrayElementSpan[] = elements.filter(
      element => element.stringValue !== null && PluginNameNormalizer.matches(element.stringValue, packageName),
    );
    if (matching.length === 0) {
      return { text: this.text, changed: false };
    }
    if (matching.length === elements.length) {
      const removedMember: string | null = this.removeMember(member);
      return removedMember === null ? null : this.verified(removedMember, true);
    }
    const removals: Array<{ start: number; end: number }> = [];
    for (const element of matching) {
      if (element.hasTrailingComma) {
        const commaIndex: number = this.scanner.skipNoise(element.valueEnd);
        removals.push({ start: element.valueStart, end: commaIndex + 1 });
        continue;
      }
      const precedingComma: number = this.text.lastIndexOf(",", element.valueStart);
      if (precedingComma < 0) {
        return null;
      }
      removals.push({ start: precedingComma, end: element.valueEnd });
    }
    removals.sort((first, second) => second.start - first.start);
    let updated: string = this.text;
    for (const removal of removals) {
      updated = updated.slice(0, removal.start) + updated.slice(removal.end);
    }
    return this.verified(updated, true);
  }

  addSkillPermissions(skillNames: readonly string[]): SpliceResult | null {
    const root: number = this.scanner.rootObjectStart();
    if (root < 0) {
      return null;
    }
    const permissionMember: JsonMemberSpan | null = this.scanner.findMember(root, "permission");
    if (permissionMember === null) {
      const inserted: string | null = this.insertRootMember(
        `"permission": ${this.skillObjectText(skillNames)}`,
        root,
      );
      return inserted === null ? null : this.verified(inserted, true);
    }
    if (permissionMember.valueKind !== "object") {
      return null;
    }
    const skillMember: JsonMemberSpan | null = this.scanner.findMember(permissionMember.valueStart, "skill");
    if (skillMember === null) {
      const inserted: string | null = this.insertMemberIntoObject(
        permissionMember.valueStart,
        `"skill": ${this.skillObjectText(skillNames)}`,
      );
      return inserted === null ? null : this.verified(inserted, true);
    }
    if (skillMember.valueKind !== "object") {
      return null;
    }
    const existing: Record<string, unknown> = ConfigSpliceWriter.readObjectEntries(
      this.text.slice(skillMember.valueStart, skillMember.valueEnd),
    );
    const missing: string[] = skillNames.filter(name => existing[name] !== "allow");
    if (missing.length === 0) {
      return { text: this.text, changed: false };
    }
    const members: JsonMemberSpan[] | null = this.scanner.objectMembers(skillMember.valueStart);
    if (members === null) {
      return null;
    }
    const appended: string | null = this.appendToSkillObject(members, skillMember.valueEnd, missing);
    return appended === null ? null : this.verified(appended, true);
  }

  private appendToSkillObject(
    members: JsonMemberSpan[],
    objectEnd: number,
    missing: readonly string[],
  ): string | null {
    const entries: string = missing.map(name => `${JSON.stringify(name)}: "allow"`).join(", ");
    if (members.length === 0) {
      const closeBracket: number = objectEnd - 1;
      return this.text.slice(0, closeBracket) + entries + this.text.slice(closeBracket);
    }
    const last: JsonMemberSpan = members[members.length - 1];
    if (last.hasTrailingComma) {
      const commaIndex: number = this.scanner.skipNoise(last.valueEnd);
      return this.text.slice(0, commaIndex + 1) + " " + entries + this.text.slice(commaIndex + 1);
    }
    return this.text.slice(0, last.valueEnd) + ", " + entries + this.text.slice(last.valueEnd);
  }

  private skillObjectText(skillNames: readonly string[]): string {
    const entries: string = skillNames.map(name => `${JSON.stringify(name)}: "allow"`).join(", ");
    return `{ ${entries} }`;
  }

  private appendToArray(
    elements: JsonArrayElementSpan[],
    arrayEnd: number,
    serializedEntry: string,
  ): string | null {
    if (elements.length === 0) {
      const closeBracket: number = arrayEnd - 1;
      return this.text.slice(0, closeBracket) + serializedEntry + this.text.slice(closeBracket);
    }
    const last: JsonArrayElementSpan = elements[elements.length - 1];
    if (last.hasTrailingComma) {
      const commaIndex: number = this.scanner.skipNoise(last.valueEnd);
      return this.text.slice(0, commaIndex + 1) + " " + serializedEntry + this.text.slice(commaIndex + 1);
    }
    return this.text.slice(0, last.valueEnd) + ", " + serializedEntry + this.text.slice(last.valueEnd);
  }

  private insertRootMember(memberText: string, root: number): string | null {
    const firstSignificant: number = this.scanner.skipNoise(root + 1);
    if (firstSignificant < this.text.length && this.text[firstSignificant] === "}") {
      return this.text.slice(0, firstSignificant) + memberText + this.text.slice(firstSignificant);
    }
    const indent: string = this.detectIndentUnit();
    return this.text.slice(0, root + 1) + `\n${indent}${memberText},` + this.text.slice(root + 1);
  }

  private insertMemberIntoObject(objectStart: number, memberText: string): string | null {
    const firstSignificant: number = this.scanner.skipNoise(objectStart + 1);
    if (firstSignificant < this.text.length && this.text[firstSignificant] === "}") {
      return this.text.slice(0, firstSignificant) + memberText + this.text.slice(firstSignificant);
    }
    const indent: string = this.indentInsideObject(objectStart);
    return this.text.slice(0, objectStart + 1) + `\n${indent}${memberText},` + this.text.slice(objectStart + 1);
  }

  private removeMember(member: JsonMemberSpan): string | null {
    const lineStart: number = this.text.lastIndexOf("\n", member.keyStart) + 1;
    let end: number = member.valueEnd;
    let position: number = this.skipHorizontalWhitespace(end);
    if (this.text[position] === ",") {
      position += 1;
      position = this.skipHorizontalWhitespace(position);
      if (this.text[position] === "\n") {
        position += 1;
      }
      end = position;
    }
    return this.text.slice(0, lineStart) + this.text.slice(end);
  }

  private skipHorizontalWhitespace(index: number): number {
    let position: number = index;
    while (position < this.text.length && (this.text[position] === " " || this.text[position] === "\t")) {
      position += 1;
    }
    return position;
  }

  private indentInsideObject(objectStart: number): string {
    const lineStart: number = this.text.lastIndexOf("\n", objectStart) + 1;
    let whitespace: string = "";
    let position: number = lineStart;
    while (position < objectStart && (this.text[position] === " " || this.text[position] === "\t")) {
      whitespace += this.text[position];
      position += 1;
    }
    return whitespace + this.detectIndentUnit();
  }

  private detectIndentUnit(): string {
    const match: RegExpMatchArray | null = this.text.match(/\n([ \t]+)"[A-Za-z_]/);
    if (match === null || match[1] === undefined) {
      return "  ";
    }
    return match[1];
  }

  private static readObjectEntries(serialized: string): Record<string, unknown> {
    const parsed: unknown | null = JsoncScanner.parseLenient(serialized);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  }

  private verified(text: string, changed: boolean): SpliceResult | null {
    if (JsoncScanner.parseLenient(text) === null) {
      return null;
    }
    return { text, changed };
  }
}
