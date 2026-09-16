import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { install, LOAD_INSTALL_OPTIONS, type InstallResult } from "./src/installer.ts";
import { RegistrationDetector } from "./src/registration.ts";

const PLUGIN_SERVICE_NAME: string = "aurelia-expert";
const INSTALL_ADVISORY_MESSAGE: string =
  `${PLUGIN_SERVICE_NAME} is not installed in any scope. ` +
  `Run "bunx ${PLUGIN_SERVICE_NAME} install --scope global" to install the Aurelia v2 skills.`;

type PluginClient = PluginInput["client"] | undefined;

interface AdvisoryState {
  emitted: boolean;
}

async function logWarn(client: PluginClient, message: string): Promise<void> {
  const log = client?.app?.log;
  if (!log) {
    console.warn(`[${PLUGIN_SERVICE_NAME}] ${message}`);
    return;
  }
  try {
    await log({ body: { service: PLUGIN_SERVICE_NAME, level: "warn", message } });
  } catch {
    console.warn(`[${PLUGIN_SERVICE_NAME}] ${message}`);
  }
}

async function emitAdvisoryOnce(state: AdvisoryState, client: PluginClient, message: string): Promise<void> {
  if (state.emitted) {
    return;
  }
  state.emitted = true;
  await logWarn(client, message);
}

async function maybeEmitInstallAdvisory(
  state: AdvisoryState,
  client: PluginClient,
  directory: string,
): Promise<void> {
  if (state.emitted || (await RegistrationDetector.hasAnyInstallation(directory))) {
    return;
  }
  await emitAdvisoryOnce(state, client, INSTALL_ADVISORY_MESSAGE);
}

async function reportLoadSkippedFiles(client: PluginClient, result: InstallResult): Promise<void> {
  for (const skippedPath of result.skipped) {
    await logWarn(
      client,
      `Skipped consumer-modified file (re-run "bunx aurelia-expert install --force" to overwrite): ${skippedPath}`,
    );
  }
}

const plugin: Plugin = async ({ directory, client }) => {
  const advisoryState: AdvisoryState = { emitted: false };

  return {
    config: async () => {
      const context = await RegistrationDetector.detect(directory);
      const scopes = RegistrationDetector.scopesToEnsure(context);

      if (scopes.length === 0) {
        await maybeEmitInstallAdvisory(advisoryState, client, directory);
        return;
      }

      for (const scope of scopes) {
        const result = await install(scope, directory, LOAD_INSTALL_OPTIONS);
        await reportLoadSkippedFiles(client, result);
      }
    },
  };
};

export default plugin;
