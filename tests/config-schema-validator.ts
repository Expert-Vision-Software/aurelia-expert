import { Schema } from "effect";
import { Config } from "@opencode/schema";

export interface SchemaVerdict {
  ok: boolean;
  config: Config.Info | null;
  issue: string | null;
}

export class ConfigSchemaValidator {
  private readonly decodeConfig = Schema.decodeUnknownResult(Config.Info);

  validateValue(value: unknown): SchemaVerdict {
    const result = this.decodeConfig(value);
    if (result._tag === "Success") {
      return { ok: true, config: result.success, issue: null };
    }
    return { ok: false, config: null, issue: this.describeIssue(result.failure) };
  }

  validateText(text: string): SchemaVerdict {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return { ok: false, config: null, issue: `fixture is not parseable JSON: ${String(error)}` };
    }
    return this.validateValue(parsed);
  }

  private describeIssue(failure: unknown): string {
    const issue = (failure as { issue?: unknown } | null)?.issue;
    const message = (issue as { message?: unknown } | null)?.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
    return JSON.stringify(failure).slice(0, 300);
  }
}
