import { Effect } from "effect";
import { Plugin } from "@opencode/plugin/effect";
import { install, LOAD_INSTALL_OPTIONS, type InstallResult, type Scope } from "./installer.ts";
import { RegistrationDetector, type RegistrationContext } from "./registration.ts";

const PLUGIN_SERVICE_NAME: string = "aurelia-expert";
const INSTALL_ADVISORY_MESSAGE: string =
  `${PLUGIN_SERVICE_NAME} is not installed in any scope. ` +
  `Run "bunx ${PLUGIN_SERVICE_NAME} install --scope global" to install the Aurelia v2 skills.`;
const SKIPPED_FILE_ADVISORY: string =
  `Skipped consumer-modified file (re-run "bunx ${PLUGIN_SERVICE_NAME} install --force" to overwrite)`;

class LoadInstaller {
  private advisoryEmitted: boolean = false;

  run(directory: string): Effect.Effect<void> {
    return Effect.promise(() => this.ensureInstalled(directory));
  }

  private async ensureInstalled(directory: string): Promise<void> {
    try {
      const context: RegistrationContext = await RegistrationDetector.detect(directory);
      const scopes: readonly Scope[] = RegistrationDetector.scopesToEnsure(context);
      if (scopes.length === 0) {
        await this.emitInstallAdvisoryOnce(directory);
        return;
      }
      for (const scope of scopes) {
        const result: InstallResult = await install(scope, directory, LOAD_INSTALL_OPTIONS);
        this.reportSkippedFiles(result);
      }
    } catch (error) {
      this.warn(`Load-time install failed and was skipped: ${LoadInstaller.describeError(error)}`);
    }
  }

  private async emitInstallAdvisoryOnce(directory: string): Promise<void> {
    if (this.advisoryEmitted || (await RegistrationDetector.hasAnyInstallation(directory))) {
      return;
    }
    this.advisoryEmitted = true;
    this.warn(INSTALL_ADVISORY_MESSAGE);
  }

  private reportSkippedFiles(result: InstallResult): void {
    for (const skippedPath of result.skipped) {
      this.warn(`${SKIPPED_FILE_ADVISORY}: ${skippedPath}`);
    }
  }

  private warn(message: string): void {
    console.warn(`[${PLUGIN_SERVICE_NAME}] ${message}`);
  }

  private static describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

const loadInstaller: LoadInstaller = new LoadInstaller();

const plugin = Plugin.define({
  id: PLUGIN_SERVICE_NAME,
  effect: (context) => loadInstaller.run(context.location.directory),
});

export default plugin;
