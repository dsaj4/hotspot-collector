import { readdir } from "node:fs/promises";
import path from "node:path";
import { validateHealthFile, validateJsonlFile, validateRawFile, type ValidationResult } from "./normalized.js";

type FixtureValidationSummary = {
  ok: boolean;
  checkedAt: string;
  results: Array<ValidationResult & { file: string }>;
};

async function existingFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

export async function validateFixtures(root = "fixtures"): Promise<FixtureValidationSummary> {
  const subscriptionFiles = await existingFiles(path.join(root, "normalized", "subscriptions"));
  const hotspotFiles = await existingFiles(path.join(root, "normalized", "hotspots"));
  const socialFiles = await existingFiles(path.join(root, "normalized", "social"));
  const healthFiles = await existingFiles(path.join(root, "health"));
  const rawFiles = await existingFiles(path.join(root, "raw"));
  const results: Array<ValidationResult & { file: string }> = [];

  for (const file of subscriptionFiles.filter((name) => name.endsWith(".jsonl"))) {
    results.push({ file, ...(await validateJsonlFile(file, "subscription")) });
  }
  for (const file of hotspotFiles.filter((name) => name.endsWith(".jsonl"))) {
    results.push({ file, ...(await validateJsonlFile(file, "hotspot")) });
  }
  for (const file of socialFiles.filter((name) => name.endsWith(".jsonl"))) {
    results.push({ file, ...(await validateJsonlFile(file, "social")) });
  }
  for (const file of healthFiles.filter((name) => name.endsWith(".json"))) {
    results.push({ file, ...(await validateHealthFile(file)) });
  }
  for (const file of rawFiles.filter((name) => name.endsWith(".json"))) {
    results.push({ file, ...(await validateRawFile(file)) });
  }

  return {
    ok: results.length > 0 && results.every((result) => result.ok),
    checkedAt: new Date().toISOString(),
    results
  };
}
