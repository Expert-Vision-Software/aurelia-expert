import { Plugin } from "@opencode/plugin/effect";
import { LoadInstaller } from "./load-installer.ts";

const PLUGIN_SERVICE_NAME: string = "aurelia-expert";

const loadInstaller: LoadInstaller = new LoadInstaller();

const plugin = Plugin.define({
  id: PLUGIN_SERVICE_NAME,
  effect: (context) => loadInstaller.run(context.location.directory),
});

export default plugin;
