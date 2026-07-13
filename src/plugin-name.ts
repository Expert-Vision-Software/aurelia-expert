export class PluginNameNormalizer {
  private static readonly AT_INDEX_NONE: number = -1;

  static normalize(entry: string): string {
    const trimmed: string = entry.trim().toLowerCase();
    const firstAt: number = trimmed.indexOf("@");
    if (firstAt === 0) {
      const secondAt: number = trimmed.indexOf("@", 1);
      if (secondAt !== PluginNameNormalizer.AT_INDEX_NONE) {
        return trimmed.slice(0, secondAt);
      }
      return trimmed;
    }
    if (firstAt !== PluginNameNormalizer.AT_INDEX_NONE) {
      return trimmed.slice(0, firstAt);
    }
    return trimmed;
  }

  matchesOurPackage(entry: string, packageName: string): boolean {
    return PluginNameNormalizer.normalize(entry) === packageName.toLowerCase();
  }
}