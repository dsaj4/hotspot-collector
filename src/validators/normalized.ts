import { readFile } from "node:fs/promises";
import type { BrowserObservation, HotspotItem, SocialItem, SourceHealth, SubscriptionItem } from "../types.js";

type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  itemCount: number;
  issues: ValidationIssue[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isIsoLike(value: unknown): boolean {
  return isString(value) && !Number.isNaN(Date.parse(value));
}

function isHttpUrl(value: unknown): boolean {
  return isString(value) && /^https?:\/\//.test(value);
}

function requireString(item: Record<string, unknown>, field: string, path: string, issues: ValidationIssue[]): void {
  if (!isString(item[field])) issues.push({ path, message: `Missing string field: ${field}` });
}

export function validateSubscriptionItem(item: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(item)) return [{ path, message: "Item must be an object." }];
  for (const field of ["id", "sourceId", "platform", "provider", "authorId", "authorName", "title", "rawRef", "dedupeKey"]) {
    requireString(item, field, path, issues);
  }
  if (!isHttpUrl(item.url)) issues.push({ path, message: "url must be an http(s) URL." });
  if (!isIsoLike(item.capturedAt)) issues.push({ path, message: "capturedAt must be parseable ISO-like time." });
  if (item.publishedAt !== null && item.publishedAt !== undefined && !isIsoLike(item.publishedAt)) {
    issues.push({ path, message: "publishedAt must be null or parseable ISO-like time." });
  }
  if (!Array.isArray(item.media)) issues.push({ path, message: "media must be an array." });
  return issues;
}

export function validateHotspotItem(item: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(item)) return [{ path, message: "Item must be an object." }];
  for (const field of ["id", "sourceId", "platform", "provider", "title", "url", "category", "rawRef", "dedupeKey"]) {
    requireString(item, field, path, issues);
  }
  if (typeof item.rank !== "number" || item.rank < 1) issues.push({ path, message: "rank must be a positive number." });
  if (!isHttpUrl(item.url)) issues.push({ path, message: "url must be an http(s) URL." });
  if (!isIsoLike(item.capturedAt)) issues.push({ path, message: "capturedAt must be parseable ISO-like time." });
  return issues;
}

export function validateSourceHealth(item: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(item)) return [{ path, message: "Health item must be an object." }];
  requireString(item, "sourceId", path, issues);
  if (!["ok", "cache", "empty", "error", "unavailable"].includes(String(item.status))) {
    issues.push({ path, message: "status must be a known SourceStatus." });
  }
  if (!isIsoLike(item.checkedAt)) issues.push({ path, message: "checkedAt must be parseable ISO-like time." });
  if (item.itemCount !== undefined && typeof item.itemCount !== "number") issues.push({ path, message: "itemCount must be a number when present." });
  return issues;
}

export function validateBrowserObservation(input: unknown, path = "observation"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(input)) return [{ path, message: "Observation must be an object." }];
  for (const field of ["sourceId", "platform", "streamType", "pageUrl", "status"]) requireString(input, field, path, issues);
  if (!isHttpUrl(input.pageUrl)) issues.push({ path, message: "pageUrl must be an http(s) URL." });
  if (!["subscription", "search", "favorite", "hotspot", "home-feed"].includes(String(input.streamType))) {
    issues.push({ path, message: "streamType must be a known SocialStreamType." });
  }
  if (!["ok", "empty", "error", "unavailable"].includes(String(input.status))) {
    issues.push({ path, message: "status must be ok, empty, error, or unavailable." });
  }
  if (!Array.isArray(input.items)) {
    issues.push({ path, message: "items must be an array." });
    return issues;
  }
  const observation = input as BrowserObservation;
  observation.items.forEach((item, index) => {
    const itemPath = `${path}.items[${index}]`;
    if (!isObject(item)) {
      issues.push({ path: itemPath, message: "Item must be an object." });
      return;
    }
    requireString(item, "title", itemPath, issues);
    if (!isHttpUrl(item.url)) issues.push({ path: itemPath, message: "url must be an http(s) URL." });
    if (observation.platform === "xiaohongshu" && observation.status === "ok") {
      if (!isString(item.body)) issues.push({ path: itemPath, message: "Xiaohongshu items require non-empty body." });
      if (!Array.isArray(item.media) || !item.media.some(isHttpUrl)) {
        issues.push({ path: itemPath, message: "Xiaohongshu items require at least one image URL." });
      }
    }
  });
  if (observation.status === "ok" && observation.items.length === 0) issues.push({ path, message: "ok observations require at least one item." });
  if (observation.status === "empty" && observation.items.length > 0) issues.push({ path, message: "empty observations cannot include items." });
  return issues;
}

export function validateSocialItem(item: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(item)) return [{ path, message: "Item must be an object." }];
  for (const field of ["id", "sourceId", "platform", "provider", "streamType", "title", "rawRef", "dedupeKey"]) {
    requireString(item, field, path, issues);
  }
  if (!isHttpUrl(item.url)) issues.push({ path, message: "url must be an http(s) URL." });
  if (!isIsoLike(item.capturedAt)) issues.push({ path, message: "capturedAt must be parseable ISO-like time." });
  if (!Array.isArray(item.media)) issues.push({ path, message: "media must be an array." });
  return issues;
}

export async function validateJsonlFile(
  filePath: string,
  kind: "subscription" | "hotspot" | "social"
): Promise<ValidationResult> {
  const text = await readFile(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const issues: ValidationIssue[] = [];
  lines.forEach((line, index) => {
    try {
      const item = JSON.parse(line) as SubscriptionItem | HotspotItem | SocialItem;
      issues.push(
        ...(kind === "subscription" ? validateSubscriptionItem(item, `${filePath}:${index + 1}`)
          : kind === "hotspot" ? validateHotspotItem(item, `${filePath}:${index + 1}`)
            : validateSocialItem(item, `${filePath}:${index + 1}`))
      );
    } catch (error) {
      issues.push({ path: `${filePath}:${index + 1}`, message: error instanceof Error ? error.message : String(error) });
    }
  });
  return { ok: issues.length === 0, itemCount: lines.length, issues };
}

export async function validateHealthFile(filePath: string): Promise<ValidationResult> {
  const payload = JSON.parse(await readFile(filePath, "utf8")) as SourceHealth[];
  const items = Array.isArray(payload) ? payload : [];
  const issues = Array.isArray(payload)
    ? items.flatMap((item, index) => validateSourceHealth(item, `${filePath}:${index + 1}`))
    : [{ path: filePath, message: "Health file must contain an array." }];
  return { ok: issues.length === 0, itemCount: items.length, issues };
}

export function validateRawSnapshot(payload: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(payload)) return [{ path, message: "Raw snapshot must be an object." }];
  const hasEvidence =
    "provider" in payload ||
    "payload" in payload ||
    "response" in payload ||
    "responses" in payload ||
    "xml" in payload ||
    "items" in payload;
  if (!hasEvidence) issues.push({ path, message: "Raw snapshot must contain provider, payload, response, responses, xml, or items." });
  return issues;
}

export async function validateRawFile(filePath: string): Promise<ValidationResult> {
  try {
    const payload = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    const issues = validateRawSnapshot(payload, filePath);
    return { ok: issues.length === 0, itemCount: 1, issues };
  } catch (error) {
    return { ok: false, itemCount: 0, issues: [{ path: filePath, message: error instanceof Error ? error.message : String(error) }] };
  }
}
