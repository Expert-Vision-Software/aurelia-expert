import type { PluginInput } from "@opencode-ai/plugin";

type PluginClient = PluginInput["client"] | undefined;

export class PluginFailureAdvisory {
  private emitted: boolean = false;

  async emitOnce(client: PluginClient, detail: string, cacheDir: string): Promise<void> {
    if (this.emitted) {
      return;
    }
    this.emitted = true;
    await this.emit(client, detail, cacheDir);
  }

  private async emit(client: PluginClient, detail: string, cacheDir: string): Promise<void> {
    const message =
      `aurelia-expert failed to install bundled skills at load: ${detail}. ` +
      `Remediation: run "bunx aurelia-expert install --scope global" (or --scope local). ` +
      `If the failure persists, clear the package cache with "bunx aurelia-expert clear-cache" ` +
      `or delete the cache directory ${cacheDir} and restart.`;
    const log = client?.app?.log;
    if (!log) {
      console.warn(`[aurelia-expert] ${message}`);
      return;
    }
    try {
      await log({ body: { service: "aurelia-expert", level: "error", message } });
    } catch {
      console.warn(`[aurelia-expert] ${message}`);
    }
  }
}
