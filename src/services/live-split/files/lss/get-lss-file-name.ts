export function getLSSFileName(dungeonName: string): string {
  const dungeonSlug = dungeonName
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return `${dungeonSlug}.lss`;
}
