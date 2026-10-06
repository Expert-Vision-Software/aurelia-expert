import { PackageCacheCleaner } from "../package-cache-cleaner.ts";

export async function clearCacheCommand(): Promise<void> {
  const cleaner = new PackageCacheCleaner();
  const result = await cleaner.clear();
  if (result.removedDirs.length === 0) {
    console.log("No aurelia-expert cache directories found.");
    return;
  }
  console.log("Removed cache directories:");
  for (const dir of result.removedDirs) {
    console.log(`  ${dir}`);
  }
}
