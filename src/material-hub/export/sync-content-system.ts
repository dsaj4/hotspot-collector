import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { contentSystemApiBase, contentSystemLoginAccount, materialWorkspaceRoot } from "../../config.js";
import { artifactPath } from "../../core/paths.js";

type SyncPackage = {
  packageId: string;
  target: string;
  syncStatus: string;
  assets: Array<Record<string, unknown> & { id: string }>;
};

type SyncResult = {
  packageRef: string;
  target: string;
  created: string[];
  updated: string[];
  skipped: string[];
};

const syncHistoryPath = artifactPath(path.join("data", "sync-history", "content-system-assets.json"));

async function readSyncHistory(): Promise<Record<string, { lastSyncedAt: string; packageRef: string }>> {
  try {
    return JSON.parse(await readFile(syncHistoryPath, "utf8")) as Record<string, { lastSyncedAt: string; packageRef: string }>;
  } catch {
    return {};
  }
}

async function writeSyncHistory(history: Record<string, { lastSyncedAt: string; packageRef: string }>): Promise<void> {
  await mkdir(path.dirname(syncHistoryPath), { recursive: true });
  await writeFile(syncHistoryPath, JSON.stringify(history, null, 2), "utf8");
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const body = await response.text();
  const parsed = body ? JSON.parse(body) : {};
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(parsed)}`);
  }
  return parsed as T;
}

async function latestSyncPackageRef(): Promise<string> {
  const root = path.join(materialWorkspaceRoot, "trend-intake-workspace", "04-sync-packages");
  const { readdir, stat } = await import("node:fs/promises");
  const days = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const day of days) {
    const dir = path.join(root, day);
    const files = (await readdir(dir))
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.join(dir, file));
    const ranked = await Promise.all(files.map(async (file) => ({ file, mtime: (await stat(file)).mtimeMs })));
    const latest = ranked.sort((a, b) => b.mtime - a.mtime)[0];
    if (latest) return path.relative(materialWorkspaceRoot, latest.file).replaceAll("\\", "/");
  }
  throw new Error("No sync package found.");
}

export async function syncLatestContentSystemAssets(packageRef?: string): Promise<SyncResult> {
  const resolvedPackageRef = packageRef ?? (await latestSyncPackageRef());
  const packageAbs = path.join(materialWorkspaceRoot, resolvedPackageRef);
  const syncPackage = JSON.parse(await readFile(packageAbs, "utf8")) as SyncPackage;
  if (syncPackage.target !== "content-system.assets") {
    throw new Error(`Unsupported sync target: ${syncPackage.target}`);
  }

  const login = await request<{ token: string }>(`${contentSystemApiBase}/api/login`, {
    method: "POST",
    body: JSON.stringify({ accountName: contentSystemLoginAccount })
  });
  const auth = { Authorization: `Bearer ${login.token}` };
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const history = await readSyncHistory();
  const forceResync = process.env.CONTENT_SYSTEM_FORCE_RESYNC === "1";

  for (const asset of syncPackage.assets ?? []) {
    const getResponse = await fetch(`${contentSystemApiBase}/api/assets/${encodeURIComponent(asset.id)}`, {
      headers: auth
    });
    if (getResponse.status === 404) {
      if (history[asset.id] && !forceResync) {
        skipped.push(`${asset.id}:missing-after-previous-sync`);
        continue;
      }
      await request(`${contentSystemApiBase}/api/assets`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify(asset)
      });
      created.push(asset.id);
      history[asset.id] = { lastSyncedAt: new Date().toISOString(), packageRef: resolvedPackageRef };
      continue;
    }
    if (getResponse.ok) {
      await request(`${contentSystemApiBase}/api/assets/${encodeURIComponent(asset.id)}`, {
        method: "PATCH",
        headers: auth,
        body: JSON.stringify(asset)
      });
      updated.push(asset.id);
      history[asset.id] = { lastSyncedAt: new Date().toISOString(), packageRef: resolvedPackageRef };
      continue;
    }
    skipped.push(asset.id);
  }
  await writeSyncHistory(history);

  return { packageRef: resolvedPackageRef, target: syncPackage.target, created, updated, skipped };
}
