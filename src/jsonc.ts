import { ConfigTextScanner } from "./config-text-scanner.ts";

export class JsoncParser {
  static parse(text: string): unknown {
    const cleaned: string = JsoncParser.clean(text);
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  private static clean(text: string): string {
    let cleaned: string = "";
    let index: number = 0;
    while (index < text.length) {
      const character: string = text[index];
      if (character === '"') {
        const stringEnd: number = ConfigTextScanner.skipString(text, index);
        cleaned += text.slice(index, stringEnd);
        index = stringEnd;
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
      if (character === ",") {
        const afterComma: number = JsoncParser.indexAfterCommaGap(text, index + 1);
        if (text[afterComma] === "}" || text[afterComma] === "]") {
          index += 1;
          continue;
        }
        cleaned += character;
        index += 1;
        continue;
      }
      cleaned += character;
      index += 1;
    }
    return cleaned;
  }

  private static indexAfterCommaGap(text: string, from: number): number {
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
}
