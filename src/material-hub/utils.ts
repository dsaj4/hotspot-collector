import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { visionLibRoot } from "../config.js";
import { dateFolder, safeTimestamp } from "../core/time.js";

export const materialHubRoot = path.join(visionLibRoot, "material-hub-workspace");

export function normalizeRelPath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

export function relFromVisionLib(absPath: string): string {
  return normalizeRelPath(path.relative(visionLibRoot, absPath));
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function writeJson(absPath: string, value: unknown): Promise<string> {
  await ensureDir(path.dirname(absPath));
  await writeFile(absPath, JSON.stringify(value, null, 2), "utf8");
  return relFromVisionLib(absPath);
}

export async function writeText(absPath: string, value: string): Promise<string> {
  await ensureDir(path.dirname(absPath));
  await writeFile(absPath, value, "utf8");
  return relFromVisionLib(absPath);
}

export async function writeJsonl(absPath: string, values: unknown[]): Promise<string> {
  await ensureDir(path.dirname(absPath));
  const body = values.map((value) => JSON.stringify(value)).join("\n");
  await writeFile(absPath, body ? `${body}\n` : "", "utf8");
  return relFromVisionLib(absPath);
}

export async function readJsonl<T>(absPath: string): Promise<T[]> {
  const text = await readFile(absPath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export async function fileExists(absPath: string): Promise<boolean> {
  try {
    await readFile(absPath, "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function latestDatedDir(root: string): Promise<string | null> {
  try {
    const dates = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
    return dates[0] ?? null;
  } catch {
    return null;
  }
}

export function hubDayPath(section: string, day = dateFolder(), fileName?: string): string {
  return fileName ? path.join(materialHubRoot, section, day, fileName) : path.join(materialHubRoot, section, day);
}

export function timestampedFile(prefix: string, ext: string): string {
  return `${prefix}-${safeTimestamp()}.${ext}`;
}
