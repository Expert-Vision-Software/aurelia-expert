import { getPackageVersion } from "./installer.ts";

const PLUGIN_SERVICE_NAME: string = "aurelia-expert";

const LITERAL_VERSION_FALLBACK: string = "<version>";

const STATIC_FALLBACK_MESSAGE: string =
  `[${PLUGIN_SERVICE_NAME}] Load-time install failed and was skipped. ` +
  `Run "bunx ${PLUGIN_SERVICE_NAME} install --scope global" to install the Aurelia v2 skills manually.`;

export class LoadFailureAdvisory {
  private shown: boolean = false;

  private readonly versionProvider: (() => Promise<string>) | null;

  constructor(versionProvider: (() => Promise<string>) | null = null) {
    this.versionProvider = versionProvider;
  }

  async emit(loadError: unknown): Promise<void> {
    try {
      if (this.shown) {
        return;
      }
      this.shown = true;
      const message: string = await this.buildMessage(loadError);
      console.warn(message);
    } catch {
      try {
        console.warn(STATIC_FALLBACK_MESSAGE);
      } catch {
        return;
      }
    }
  }

  private async buildMessage(loadError: unknown): Promise<string> {
    const version: string = await this.resolveVersion();
    const detail: string = loadError instanceof Error ? loadError.message : String(loadError);
    return (
      `[${PLUGIN_SERVICE_NAME}] Load-time install failed and was skipped: ${detail}. ` +
      `Run "bunx ${PLUGIN_SERVICE_NAME} install --scope global" to install the Aurelia v2 skills manually. ` +
      `If the installed generation is stale or incomplete, remove the npm cache key ` +
      `$XDG_CACHE_HOME/opencode/npm/${PLUGIN_SERVICE_NAME}@${version} and restart opencode.`
    );
  }

  private async resolveVersion(): Promise<string> {
    try {
      if (this.versionProvider !== null) {
        return await this.versionProvider();
      }
      return await getPackageVersion();
    } catch {
      return LITERAL_VERSION_FALLBACK;
    }
  }
}
