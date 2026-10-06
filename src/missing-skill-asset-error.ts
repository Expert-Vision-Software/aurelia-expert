export interface MissingSkillAssetDetails {
  packageName: string;
  version: string;
  missingPath: string;
  cacheDirectory: string;
}

export class MissingSkillAssetError extends Error {
  constructor(details: MissingSkillAssetDetails) {
    super(
      `Bundled skill assets are missing at ${details.missingPath}. ` +
        `The installed package ${details.packageName}@${details.version} is incomplete — ` +
        `this usually means the OpenCode package cache was only partially extracted. ` +
        `Remove the cache directory ${details.cacheDirectory} so the next start re-installs it. ` +
        `Remediation: run "bunx ${details.packageName} clear-cache", then reinstall with ` +
        `"bunx ${details.packageName} install --scope global" (or restart OpenCode).`,
    );
    this.name = "MissingSkillAssetError";
  }
}
