import type { Scope } from "./installer.ts";

export class ScopeResolver {
  static resolve(directory: string, globalConfigPath: string): Scope {
    const isExact: boolean = directory === globalConfigPath;
    const isUnderForward: boolean = directory.startsWith(globalConfigPath + "/");
    const isUnderBack: boolean = directory.startsWith(globalConfigPath + "\\");
    if (isExact || isUnderForward || isUnderBack) {
      return "global";
    }
    return "local";
  }
}