import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { hotspotSources, subscriptionSources } from "../config.js";
import type { SourceConfig } from "../types.js";

type SourceCatalogFile = SourceConfig[] | { sources?: SourceConfig[] };

const defaultCatalogPath = path.join(process.cwd(), "config", "sources.json");

function sourceCatalogPath(): string {
  return process.env.SOURCE_CATALOG_PATH || defaultCatalogPath;
}

function parseCatalogFile(text: string): SourceConfig[] {
  const payload = JSON.parse(text) as SourceCatalogFile;
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload.sources) ? payload.sources : [];
}

export function defaultSources(): SourceConfig[] {
  return [...subscriptionSources, ...hotspotSources];
}

export function loadSourceCatalog(filePath = sourceCatalogPath()): SourceConfig[] {
  if (!existsSync(filePath)) return defaultSources();
  const parsed = parseCatalogFile(readFileSync(filePath, "utf8"));
  return parsed.length ? parsed : defaultSources();
}

export function enabledSources(sources = loadSourceCatalog()): SourceConfig[] {
  return sources.filter((source) => source.enabled);
}
