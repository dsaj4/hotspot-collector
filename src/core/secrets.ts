import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type SecretType = "cookie" | "token" | "note";

export type SecretRecord = {
  platform: string;
  type: SecretType;
  value: string;
  updatedAt: string;
};

export type SecretStatus = {
  platform: string;
  type: SecretType;
  configured: boolean;
  updatedAt: string;
  valueHashSuffix: string;
};

function secretsFile(rootDir = process.cwd()): string {
  return path.join(rootDir, "data", "secrets", "credentials.json");
}

function hashSuffix(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(-8);
}

async function readSecrets(rootDir = process.cwd()): Promise<SecretRecord[]> {
  try {
    const payload = JSON.parse(await readFile(secretsFile(rootDir), "utf8")) as SecretRecord[];
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

async function writeSecrets(records: SecretRecord[], rootDir = process.cwd()): Promise<void> {
  const file = secretsFile(rootDir);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(records, null, 2), "utf8");
}

export async function saveSecret(input: { platform: string; type: SecretType; value: string }, rootDir = process.cwd()): Promise<SecretStatus> {
  const platform = input.platform.trim().toLowerCase();
  const value = input.value.trim();
  if (!platform) throw new Error("platform is required.");
  if (!value) throw new Error("value is required.");

  const records = (await readSecrets(rootDir)).filter((record) => record.platform !== platform);
  const record: SecretRecord = { platform, type: input.type, value, updatedAt: new Date().toISOString() };
  await writeSecrets([...records, record], rootDir);
  return toStatus(record);
}

export async function deleteSecret(platform: string, rootDir = process.cwd()): Promise<{ deleted: boolean }> {
  const normalized = platform.trim().toLowerCase();
  const records = await readSecrets(rootDir);
  const next = records.filter((record) => record.platform !== normalized);
  if (next.length === records.length) return { deleted: false };
  await writeSecrets(next, rootDir);
  return { deleted: true };
}

export async function clearSecrets(rootDir = process.cwd()): Promise<void> {
  await rm(secretsFile(rootDir), { force: true });
}

export async function secretStatuses(rootDir = process.cwd()): Promise<SecretStatus[]> {
  return (await readSecrets(rootDir)).map(toStatus);
}

export async function getSecret(platform: string, rootDir = process.cwd()): Promise<SecretRecord | null> {
  const normalized = platform.trim().toLowerCase();
  return (await readSecrets(rootDir)).find((record) => record.platform === normalized) ?? null;
}

function toStatus(record: SecretRecord): SecretStatus {
  return {
    platform: record.platform,
    type: record.type,
    configured: Boolean(record.value),
    updatedAt: record.updatedAt,
    valueHashSuffix: hashSuffix(record.value)
  };
}
