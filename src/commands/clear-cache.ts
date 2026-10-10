import { getPackageName, getPackageVersion } from "../installer.ts";
import { NpmCachePruner } from "../npm-cache-pruner.ts";

export async function clearCacheCommand(): Promise<void> {
  const packageName: string = await getPackageName();
  const version: string = await getPackageVersion();
  const pruner: NpmCachePruner = new NpmCachePruner(packageName, version);
  const removed: string[] = await pruner.prune();

  if (removed.length === 0) {
    console.log("aurelia-expert npm cache is already clear.");
    return;
  }
  console.log(`aurelia-expert removed npm cache keys under ${NpmCachePruner.cacheBase()}:`);
  for (const key of removed) {
    console.log(`  ${key}`);
  }
}
