export type JsonValueKind = "object" | "array" | "string" | "other";

export interface JsonMemberSpan {
  key: string;
  keyStart: number;
  valueStart: number;
  valueEnd: number;
  valueKind: JsonValueKind;
  hasTrailingComma: boolean;
}

export interface JsonArrayElementSpan {
  valueStart: number;
  valueEnd: number;
  valueKind: JsonValueKind;
  stringValue: string | null;
  hasTrailingComma: boolean;
}

interface StringScan {
  endIndex: number;
  value: string;
}

interface ValueScan {
  endIndex: number;
  kind: JsonValueKind;
}

const ESCAPE_CHARACTERS: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  '"': '"',
  "\\": "\\",
  "/": "/",
};

export class JsoncScanner {
  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  static parseLenient(text: string): unknown | null {
    const stripped: string = JsoncScanner.stripComments(text);
    const withoutTrailingCommas: string = stripped.replace(/,(\s*[}\]])/g, "$1");
    try {
      return JSON.parse(withoutTrailingCommas);
    } catch {
      return null;
    }
  }

  private static stripComments(text: string): string {
    let out: string = "";
    let index: number = 0;
    let insideString: boolean = false;
    while (index < text.length) {
      const character: string = text[index];
      if (insideString) {
        if (character === "\\") {
          out += text.slice(index, index + 2);
          index += 2;
          continue;
        }
        if (character === '"') {
          insideString = false;
        }
        out += character;
        index += 1;
        continue;
      }
      if (character === '"') {
        insideString = true;
        out += character;
        index += 1;
        continue;
      }
      if (character === "/" && text[index + 1] === "/") {
        while (index < text.length && text[index] !== "\n") {
          index += 1;
        }
        continue;
      }
      if (character === "/" && text[index + 1] === "*") {
        index += 2;
        while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) {
          index += 1;
        }
        index += 2;
        out += " ";
        continue;
      }
      out += character;
      index += 1;
    }
    return out;
  }

  rootObjectStart(): number {
    return this.text.indexOf("{");
  }

  skipNoise(index: number): number {
    let position: number = index;
    while (position < this.text.length) {
      const character: string = this.text[position];
      if (character === " " || character === "\t" || character === "\n" || character === "\r") {
        position += 1;
        continue;
      }
      if (character === "/" && this.text[position + 1] === "/") {
        while (position < this.text.length && this.text[position] !== "\n") {
          position += 1;
        }
        continue;
      }
      if (character === "/" && this.text[position + 1] === "*") {
        position += 2;
        while (position < this.text.length && !(this.text[position] === "*" && this.text[position + 1] === "/")) {
          position += 1;
        }
        position += 2;
        continue;
      }
      break;
    }
    return position;
  }

  objectMembers(objectStart: number): JsonMemberSpan[] | null {
    const members: JsonMemberSpan[] = [];
    let position: number = this.skipNoise(objectStart + 1);
    while (position < this.text.length && this.text[position] !== "}") {
      if (this.text[position] !== '"') {
        return null;
      }
      const keyScan: StringScan | null = this.scanString(position);
      if (keyScan === null) {
        return null;
      }
      const colon: number = this.skipNoise(keyScan.endIndex);
      if (this.text[colon] !== ":") {
        return null;
      }
      const valueStart: number = this.skipNoise(colon + 1);
      const value: ValueScan | null = this.scanValue(valueStart);
      if (value === null) {
        return null;
      }
      members.push({
        key: keyScan.value,
        keyStart: position,
        valueStart,
        valueEnd: value.endIndex,
        valueKind: value.kind,
        hasTrailingComma: this.hasTrailingCommaAt(value.endIndex),
      });
      position = this.skipNoise(value.endIndex);
      if (this.text[position] === ",") {
        position = this.skipNoise(position + 1);
        continue;
      }
      if (this.text[position] === "}") {
        break;
      }
      return null;
    }
    return members;
  }

  findMember(objectStart: number, key: string): JsonMemberSpan | null {
    const members: JsonMemberSpan[] | null = this.objectMembers(objectStart);
    if (members === null) {
      return null;
    }
    return members.find(member => member.key === key) ?? null;
  }

  arrayElements(arrayStart: number): JsonArrayElementSpan[] | null {
    const elements: JsonArrayElementSpan[] = [];
    let position: number = this.skipNoise(arrayStart + 1);
    while (position < this.text.length && this.text[position] !== "]") {
      const value: ValueScan | null = this.scanValue(position);
      if (value === null) {
        return null;
      }
      const stringValue: string | null =
        value.kind === "string" ? (this.scanString(position) as StringScan).value : null;
      elements.push({
        valueStart: position,
        valueEnd: value.endIndex,
        valueKind: value.kind,
        stringValue,
        hasTrailingComma: this.hasTrailingCommaAt(value.endIndex),
      });
      position = this.skipNoise(value.endIndex);
      if (this.text[position] === ",") {
        position = this.skipNoise(position + 1);
        continue;
      }
      if (this.text[position] === "]") {
        break;
      }
      return null;
    }
    return elements;
  }

  nextSignificantCharacter(index: number): string | null {
    const position: number = this.skipNoise(index);
    if (position >= this.text.length) {
      return null;
    }
    return this.text[position];
  }

  private hasTrailingCommaAt(valueEnd: number): boolean {
    return this.nextSignificantCharacter(valueEnd) === ",";
  }

  private scanString(index: number): StringScan | null {
    let position: number = index + 1;
    let value: string = "";
    while (position < this.text.length) {
      const character: string = this.text[position];
      if (character === "\\") {
        const next: string = this.text[position + 1];
        if (next === "u") {
          const hex: string = this.text.slice(position + 2, position + 6);
          const code: number = parseInt(hex, 16);
          if (Number.isNaN(code)) {
            return null;
          }
          value += String.fromCharCode(code);
          position += 6;
          continue;
        }
        value += ESCAPE_CHARACTERS[next] ?? next;
        position += 2;
        continue;
      }
      if (character === '"') {
        return { endIndex: position + 1, value };
      }
      value += character;
      position += 1;
    }
    return null;
  }

  private scanValue(index: number): ValueScan | null {
    const character: string = this.text[index];
    if (character === '"') {
      const stringScan: StringScan | null = this.scanString(index);
      return stringScan === null ? null : { endIndex: stringScan.endIndex, kind: "string" };
    }
    if (character === "{" || character === "[") {
      return this.scanBracketedValue(index, character);
    }
    let position: number = index;
    while (position < this.text.length && !/[\s,}\]]/.test(this.text[position])) {
      position += 1;
    }
    return { endIndex: position, kind: "other" };
  }

  private scanBracketedValue(start: number, opener: string): ValueScan | null {
    const kind: JsonValueKind = opener === "{" ? "object" : "array";
    let depth: number = 0;
    let position: number = start;
    while (position < this.text.length) {
      const character: string = this.text[position];
      if (character === '"') {
        const stringScan: StringScan | null = this.scanString(position);
        if (stringScan === null) {
          return null;
        }
        position = stringScan.endIndex;
        continue;
      }
      if (character === "/" && (this.text[position + 1] === "/" || this.text[position + 1] === "*")) {
        position = this.skipNoise(position);
        continue;
      }
      if (character === "{" || character === "[") {
        depth += 1;
      }
      if (character === "}" || character === "]") {
        depth -= 1;
        if (depth === 0) {
          return { endIndex: position + 1, kind };
        }
      }
      position += 1;
    }
    return null;
  }
}
