import { readFileSync } from "node:fs";
import path from "node:path";
import { artifactPath } from "../../core/paths.js";

export type BiliSumLocalConfig = {
  projectRoot?: string;
  baseUrl?: string;
  accessToken?: string;
  appDataRoot?: string;
  configuredAt?: string;
};

export function bilisumLocalConfigPath(rootDir = process.cwd()): string {
  return rootDir === process.cwd()
    ? artifactPath(path.join("data", "secrets", "bilisum.json"))
    : path.join(rootDir, "data", "secrets", "bilisum.json");
}

export function readBiliSumLocalConfig(rootDir = process.cwd()): BiliSumLocalConfig {
  try {
    const value = JSON.parse(readFileSync(bilisumLocalConfigPath(rootDir), "utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as BiliSumLocalConfig) : {};
  } catch {
    return {};
  }
}
