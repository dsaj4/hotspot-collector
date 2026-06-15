import path from "node:path";

export const recommendedDataRoot = "E:/Project/hotspot-collector-data";
export const recommendedExternalRoot = "E:/Project/hotspot-collector-external";
export const projectWorkspaceRoot = "E:/Project/hotspot-collector";

function normalizePath(value: string): string {
  return path.resolve(value).replaceAll("\\", "/").toLowerCase();
}

function isDefaultWorkspace(rootDir: string): boolean {
  return normalizePath(rootDir) === normalizePath(projectWorkspaceRoot);
}

export function dataRoot(rootDir = process.cwd()): string {
  return path.resolve(process.env.HOTSPOT_DATA_ROOT ?? (isDefaultWorkspace(rootDir) ? recommendedDataRoot : path.join(rootDir, "data")));
}

export function externalRoot(rootDir = process.cwd()): string {
  return path.resolve(process.env.HOTSPOT_EXTERNAL_ROOT ?? (isDefaultWorkspace(rootDir) ? recommendedExternalRoot : path.join(rootDir, "external")));
}

export function dataPath(...segments: string[]): string {
  return path.join(dataRoot(), ...segments);
}

export function externalPath(...segments: string[]): string {
  return path.join(externalRoot(), ...segments);
}

export function artifactPath(ref: string): string {
  const normalized = ref.replaceAll("\\", "/");
  if (normalized === "data") return dataRoot();
  if (normalized.startsWith("data/")) return path.join(dataRoot(), normalized.slice("data/".length));
  if (normalized === "reports") return path.join(dataRoot(), "reports");
  if (normalized.startsWith("reports/")) return path.join(dataRoot(), normalized);
  return path.resolve(ref);
}
