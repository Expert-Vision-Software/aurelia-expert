export interface MemberRegion {
  keyStart: number;
  valueStart: number;
  valueEnd: number;
}

export interface ElementRegion {
  start: number;
  end: number;
}

export class ConfigTextScanner {
  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  static skipWhitespaceAndComments(text: string, from: number): number {
    let index: number = from;
    while (index < text.length) {
      const character: string = text[index];
      if (character === " " || character === "\t" || character === "\n" || character === "\r") {
        index += 1;
        continue;
      }
      if (character === "/" && text[index + 1] === "/") {
        index = ConfigTextScanner.endOfLineComment(text, index);
        continue;
      }
      if (character === "/" && text[index + 1] === "*") {
        index = ConfigTextScanner.endOfBlockComment(text, index);
        continue;
      }
      return index;
    }
    return index;
  }

  static skipString(text: string, openingQuoteIndex: number): number {
    let index: number = openingQuoteIndex + 1;
    while (index < text.length) {
      const character: string = text[index];
      if (character === "\\") {
        index += 2;
        continue;
      }
      if (character === '"') {
        return index + 1;
      }
      index += 1;
    }
    return text.length;
  }

  static endOfLineComment(text: string, from: number): number {
    let index: number = from;
    while (index < text.length && text[index] !== "\n") {
      index += 1;
    }
    return index;
  }

  static endOfBlockComment(text: string, from: number): number {
    const close: number = text.indexOf("*/", from + 2);
    return close === -1 ? text.length : close + 2;
  }

  findMemberValue(key: string, from: number, to: number): MemberRegion | null {
    let index: number = ConfigTextScanner.skipWhitespaceAndComments(this.text, from);
    if ((this.text[index] === "{" || this.text[index] === "[") && index < to) {
      index = ConfigTextScanner.skipWhitespaceAndComments(this.text, index + 1);
    }
    while (index < to) {
      const character: string = this.text[index];
      if (character === '"') {
        const stringEnd: number = ConfigTextScanner.skipString(this.text, index);
        const token: string = this.text.slice(index + 1, stringEnd - 1);
        if (token === key) {
          const colonIndex: number = ConfigTextScanner.skipWhitespaceAndComments(this.text, stringEnd);
          if (this.text[colonIndex] === ":") {
            const valueStart: number = ConfigTextScanner.skipWhitespaceAndComments(this.text, colonIndex + 1);
            const valueEnd: number = this.skipValue(valueStart);
            return { keyStart: index, valueStart, valueEnd };
          }
        }
        index = stringEnd;
        continue;
      }
      if (character === "{" || character === "[") {
        index = this.skipValue(index);
        continue;
      }
      index += 1;
    }
    return null;
  }

  arrayElementRegions(valueStart: number, valueEnd: number): ElementRegion[] {
    const regions: ElementRegion[] = [];
    let index: number = ConfigTextScanner.skipWhitespaceAndComments(this.text, valueStart + 1);
    while (index < valueEnd) {
      if (this.text[index] === "]") {
        break;
      }
      const start: number = index;
      const end: number = this.skipValue(index);
      regions.push({ start, end });
      index = ConfigTextScanner.skipWhitespaceAndComments(this.text, end);
      if (this.text[index] === ",") {
        index = ConfigTextScanner.skipWhitespaceAndComments(this.text, index + 1);
        continue;
      }
      break;
    }
    return regions;
  }

  skipValue(from: number): number {
    const character: string = this.text[from];
    if (character === '"') {
      return ConfigTextScanner.skipString(this.text, from);
    }
    if (character === "{" || character === "[") {
      const closeCharacter: string = character === "{" ? "}" : "]";
      let depth: number = 0;
      let index: number = from;
      while (index < this.text.length) {
        const current: string = this.text[index];
        if (current === '"') {
          index = ConfigTextScanner.skipString(this.text, index);
          continue;
        }
        if (current === "/" && (this.text[index + 1] === "/" || this.text[index + 1] === "*")) {
          index = this.text[index + 1] === "/"
            ? ConfigTextScanner.endOfLineComment(this.text, index)
            : ConfigTextScanner.endOfBlockComment(this.text, index);
          continue;
        }
        if (current === "{" || current === "[") {
          depth += 1;
        } else if (current === "}" || current === "]") {
          depth -= 1;
          if (depth === 0 && current === closeCharacter) {
            return index + 1;
          }
        }
        index += 1;
      }
      return this.text.length;
    }
    let index: number = from;
    while (index < this.text.length) {
      const current: string = this.text[index];
      if (current === "," || current === "}" || current === "]" || current === "\n" || current === "\r"
        || current === " " || current === "\t" || current === "/") {
        return index;
      }
      index += 1;
    }
    return index;
  }
}
