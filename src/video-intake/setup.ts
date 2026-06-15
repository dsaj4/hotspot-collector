import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { access, appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { bilibiliCookie, deepseekApiKey, deepseekBaseUrl, deepseekModel } from "../config.js";
import { getSecret } from "../core/secrets.js";
import { bilisumLocalConfigPath, readBiliSumLocalConfig, type BiliSumLocalConfig } from "./local-config.js";
import { exportBilibiliCdpCookies } from "./bilibili-cookie-bridge.js";

type SetupOptions = {
  projectRoot?: string;
  baseUrl?: string;
  start?: boolean;
  waitMs?: number;
};

export type BiliSumSetupResult = {
  configured: boolean;
  projectRoot: string;
  baseUrl: string;
  appDataRoot: string;
  accessTokenConfigured: boolean;
  serviceStatus: "running" | "started" | "unavailable";
  health?: unknown;
  warnings: string[];
  configRef: string;
};

const defaultCandidates = [
  "E:/Project/BiliSum",
  "E:/Project/bilisum",
  "E:/Project/vision-lib/.tmp-bilisum-analysis"
];

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findBiliSumProject(explicit?: string): Promise<string> {
  const candidates = [explicit, process.env.BILISUM_PROJECT_ROOT, ...defaultCandidates].filter((item): item is string => Boolean(item));
  for (const candidate of candidates) {
    const root = path.resolve(candidate);
    if ((await exists(path.join(root, "pyproject.toml"))) && (await exists(path.join(root, "apps", "service", "src", "video_sum_service", "main.py")))) {
      return root;
    }
  }
  throw new Error(`BiliSum project not found. Checked: ${candidates.join(", ")}`);
}

async function health(baseUrl: string, timeoutMs = 3000): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForHealth(baseUrl: string, waitMs: number): Promise<unknown | null> {
  const started = Date.now();
  while (Date.now() - started <= waitMs) {
    const value = await health(baseUrl);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

async function writeLocalConfig(config: BiliSumLocalConfig): Promise<string> {
  const file = bilisumLocalConfigPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(config, null, 2), "utf8");
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

async function writeBiliSumEnv(projectRoot: string, values: Record<string, string>): Promise<void> {
  const file = path.join(projectRoot, ".env.hotspot-collector");
  const body = Object.entries(values)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${key}=${value.replace(/\r?\n/g, "")}`)
    .join("\n");
  await writeFile(file, `${body}\n`, "utf8");
  const localExclude = path.join(projectRoot, ".git", "info", "exclude");
  try {
    const current = await readFile(localExclude, "utf8");
    if (!current.split(/\r?\n/).includes(".env.hotspot-collector")) await appendFile(localExclude, "\n.env.hotspot-collector\n", "utf8");
  } catch {
    // Non-git BiliSum installations do not need a local exclude.
  }
}

async function findFfmpegDir(): Promise<string> {
  const candidates = [
    process.env.VIDEO_SUM_FFMPEG_DIR,
    path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "Microsoft", "WinGet", "Links")
  ].filter((item): item is string => Boolean(item));
  for (const candidate of candidates) {
    if ((await exists(path.join(candidate, "ffmpeg.exe"))) && (await exists(path.join(candidate, "ffprobe.exe")))) return candidate;
  }
  return "";
}

function startBiliSum(projectRoot: string, env: Record<string, string>): void {
  const child = spawn("uv", ["run", "--package", "video-sum-service", "python", "-m", "video_sum_service"], {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
}

export async function setupBiliSum(options: SetupOptions = {}): Promise<BiliSumSetupResult> {
  const projectRoot = await findBiliSumProject(options.projectRoot);
  const existing = readBiliSumLocalConfig();
  const accessToken = existing.accessToken || randomBytes(32).toString("base64url");
  const appDataRoot = existing.appDataRoot || path.join(process.cwd(), "data", "bilisum");
  const baseUrl = options.baseUrl || existing.baseUrl || "http://127.0.0.1:3838";
  const warnings: string[] = [];
  const ffmpegDir = await findFfmpegDir();
  const storedDeepSeek = await getSecret("deepseek");
  const resolvedDeepSeekApiKey = deepseekApiKey || storedDeepSeek?.value || "";
  const cookieBridge = await exportBilibiliCdpCookies(appDataRoot);
  if (cookieBridge.warning) warnings.push(cookieBridge.warning);
  const env = {
    VIDEO_SUM_HOST: "127.0.0.1",
    VIDEO_SUM_PORT: new URL(baseUrl).port || "3838",
    VIDEO_SUM_ACCESS_TOKEN: accessToken,
    VIDEO_SUM_APP_DATA_ROOT: appDataRoot,
    VIDEO_SUM_LLM_ENABLED: resolvedDeepSeekApiKey ? "true" : "false",
    VIDEO_SUM_LLM_BASE_URL: deepseekBaseUrl,
    VIDEO_SUM_LLM_MODEL: deepseekModel,
    VIDEO_SUM_LLM_API_KEY: resolvedDeepSeekApiKey,
    VIDEO_SUM_FFMPEG_DIR: ffmpegDir,
    VIDEO_SUM_YTDLP_COOKIES_FILE: cookieBridge.cookieFile ?? ""
  };
  if (!resolvedDeepSeekApiKey) warnings.push("DeepSeek API key is not configured; save it with secrets:set --platform=deepseek --type=token, then rerun setup.");
  if (!bilibiliCookie && !cookieBridge.cookieFile) warnings.push("Bilibili cookies are not configured; some Bilibili videos may be unavailable to BiliSum.");
  if (!ffmpegDir) warnings.push("FFmpeg was not found; BiliSum visual evidence frame extraction will be unavailable.");

  const configRef = await writeLocalConfig({ projectRoot, baseUrl, accessToken, appDataRoot, configuredAt: new Date().toISOString() });
  await writeBiliSumEnv(projectRoot, env);

  const before = await health(baseUrl);
  if (before) {
    return { configured: true, projectRoot, baseUrl, appDataRoot, accessTokenConfigured: true, serviceStatus: "running", health: before, warnings, configRef };
  }
  if (options.start === false) {
    return { configured: true, projectRoot, baseUrl, appDataRoot, accessTokenConfigured: true, serviceStatus: "unavailable", warnings, configRef };
  }

  startBiliSum(projectRoot, env);
  const after = await waitForHealth(baseUrl, options.waitMs ?? 120_000);
  if (!after) warnings.push("BiliSum was started but did not become healthy before the setup timeout.");
  return {
    configured: true,
    projectRoot,
    baseUrl,
    appDataRoot,
    accessTokenConfigured: true,
    serviceStatus: after ? "started" : "unavailable",
    health: after ?? undefined,
    warnings,
    configRef
  };
}

export async function bilisumSetupStatus(): Promise<Record<string, unknown>> {
  const config = readBiliSumLocalConfig();
  const baseUrl = config.baseUrl ?? "http://127.0.0.1:3838";
  return {
    configured: Boolean(config.projectRoot && config.accessToken),
    projectRoot: config.projectRoot,
    baseUrl,
    appDataRoot: config.appDataRoot,
    accessTokenConfigured: Boolean(config.accessToken),
    serviceHealth: await health(baseUrl)
  };
}
