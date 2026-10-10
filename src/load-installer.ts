import { Effect } from "effect";
import { install, LOAD_INSTALL_OPTIONS, type InstallResult, type Scope } from "./installer.ts";
import { RegistrationDetector, type RegistrationContext } from "./registration.ts";
import { LoadFailureAdvisory } from "./load-failure-advisory.ts";

const PLUGIN_SERVICE_NAME: string = "aurelia-expert";
const INSTALL_ADVISORY_MESSAGE: string =
  `${PLUGIN_SERVICE_NAME} is not installed in any scope. ` +
  `Run "bunx ${PLUGIN_SERVICE_NAME} install --scope global" to install the Aurelia v2 skills.`;
const SKIPPED_FILE_ADVISORY: string =
  `Skipped consumer-modified file (re-run "bunx ${PLUGIN_SERVICE_NAME} install --force" to overwrite)`;

export class LoadInstaller {
  private readonly advisoryShownDirectories: Set<string> = new Set<string>();

  private readonly failureAdvisory: LoadFailureAdvisory = new LoadFailureAdvisory();

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
      await this.emitFailureAdvisoryOnce(error);
    }
  }

  private async emitInstallAdvisoryOnce(directory: string): Promise<void> {
    try {
      if (this.advisoryShownDirectories.has(directory) || (await RegistrationDetector.hasAnyInstallation(directory))) {
        return;
      }
      this.advisoryShownDirectories.add(directory);
      this.warn(INSTALL_ADVISORY_MESSAGE);
    } catch {
      return;
    }
  }

  private async emitFailureAdvisoryOnce(error: unknown): Promise<void> {
    try {
      await this.failureAdvisory.emit(error);
    } catch {
      return;
    }
  }

  private reportSkippedFiles(result: InstallResult): void {
    try {
      for (const skippedPath of result.skipped) {
        this.warn(`${SKIPPED_FILE_ADVISORY}: ${skippedPath}`);
      }
    } catch {
      return;
    }
  }

  private warn(message: string): void {
    console.warn(`[${PLUGIN_SERVICE_NAME}] ${message}`);
  }
}
