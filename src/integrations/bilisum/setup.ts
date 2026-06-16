import { randomBytes } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { access, appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";
import { bilibiliCookie, bilisumAppDataRoot, bilisumProjectRoot, deepseekApiKey, deepseekBaseUrl, deepseekModel } from "../../config.js";
import { getSecret } from "../../core/secrets.js";
import { dataPath, externalPath } from "../../core/paths.js";
import { bilisumLocalConfigPath, readBiliSumLocalConfig, type BiliSumLocalConfig } from "./local-config.js";
import { exportBilibiliCdpCookies } from "./bilibili-cookie-bridge.js";

type SetupOptions = {
  projectRoot?: string;
  baseUrl?: string;
  start?: boolean;
  waitMs?: number;
  secretLookup?: (name: string) => Promise<string | null>;
};

export type BiliSumSetupResult = {
  configured: boolean;
  projectRoot: string;
  baseUrl: string;
  appDataRoot: string;
  accessTokenConfigured: boolean;
  serviceStatus: "running" | "started" | "unavailable";
  health?: unknown;
  llmConfigured: boolean;
  settingsUpdated: boolean;
  warnings: string[];
  configRef: string;
};

const execFileAsync = promisify(execFile);

function defaultCandidates(): string[] {
  return [
    externalPath("BiliSum"),
    "E:/Project/BiliSum",
    "E:/Project/bilisum"
  ];
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findBiliSumProject(explicit?: string): Promise<string> {
  const candidates = [explicit, process.env.BILISUM_PROJECT_ROOT, ...defaultCandidates()].filter((item): item is string => Boolean(item));
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

async function requestJson(baseUrl: string, pathName: string, accessToken: string, init: RequestInit = {}, timeoutMs = 5000): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined)
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch(`${baseUrl}${pathName}`, { ...init, headers, signal: controller.signal });
    if (!response.ok) return null;
    const value = await response.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
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

async function readBitwardenSecret(name: string): Promise<string | null> {
  if (process.env.VITEST || process.env.NODE_ENV === "test" || process.env.HOTSPOT_DISABLE_BITWARDEN_SECRETS === "1") return null;
  const script = "C:\\Users\\Administrator\\.secrets\\get-bitwarden-secret.ps1";
  try {
    await access(script);
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Name", name, "-ProjectPath", process.cwd()],
      { timeout: 60_000, windowsHide: true }
    );
    const value = stdout.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

async function readKeePassSecretFromBroker(name: string): Promise<string | null> {
  if (process.env.VITEST || process.env.NODE_ENV === "test" || process.env.HOTSPOT_DISABLE_LOCAL_SECRET_BROKER === "1") return null;
  const script = "C:\\Users\\Administrator\\.secrets\\get-local-secret.ps1";
  try {
    await access(script);
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Name", name],
      { timeout: 120_000, windowsHide: true }
    );
    const value = stdout.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

async function resolveDeepSeekApiKey(secretLookup?: (name: string) => Promise<string | null>): Promise<string> {
  if (deepseekApiKey) return deepseekApiKey;
  const lookedUp = await secretLookup?.("DEEPSEEK_API_KEY");
  if (lookedUp) return lookedUp;
  const bitwardenSecret = await readBitwardenSecret("DEEPSEEK_API_KEY");
  if (bitwardenSecret) return bitwardenSecret;
  const storedDeepSeek = await getSecret("deepseek");
  if (storedDeepSeek?.value) return storedDeepSeek.value;
  return await readKeePassSecretFromBroker("DEEPSEEK_API_KEY") ?? "";
}

async function findExistingBiliSumCookieFile(appDataRoot: string): Promise<string | null> {
  const candidates = [
    path.join(appDataRoot, "cookies", "bilibili.txt"),
    path.join(appDataRoot, "data", "cookies", "bilibili.txt")
  ];
  for (const cookieFile of candidates) {
    try {
      await access(cookieFile);
      return cookieFile;
    } catch {
      // Continue looking for cookies written by another BiliSum login flow.
    }
  }
  return null;
}

async function updateBiliSumSettings(baseUrl: string, accessToken: string, env: Record<string, string>): Promise<boolean> {
  const payload = {
    llm_enabled: env.VIDEO_SUM_LLM_ENABLED === "true",
    llm_provider: "openai-compatible",
    llm_base_url: env.VIDEO_SUM_LLM_BASE_URL,
    llm_model: env.VIDEO_SUM_LLM_MODEL,
    llm_api_key: env.VIDEO_SUM_LLM_API_KEY,
    visual_evidence_base_url: env.VIDEO_SUM_LLM_BASE_URL,
    visual_evidence_model: env.VIDEO_SUM_LLM_MODEL,
    visual_evidence_api_key: env.VIDEO_SUM_LLM_API_KEY,
    ytdlp_cookies_file: env.VIDEO_SUM_YTDLP_COOKIES_FILE
  };
  const response = await requestJson(baseUrl, "/api/v1/settings", accessToken, { method: "PUT", body: JSON.stringify(payload) }, 10_000);
  return Boolean(response?.saved);
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
  const appDataRoot = process.env.BILISUM_APP_DATA_ROOT || existing.appDataRoot || dataPath("bilisum");
  const baseUrl = options.baseUrl || existing.baseUrl || "http://127.0.0.1:3838";
  const warnings: string[] = [];
  const ffmpegDir = await findFfmpegDir();
  const resolvedDeepSeekApiKey = await resolveDeepSeekApiKey(options.secretLookup);
  const cookieBridge = await exportBilibiliCdpCookies(appDataRoot);
  let cookieFile = cookieBridge.cookieFile;
  if (!cookieFile) {
    cookieFile = await findExistingBiliSumCookieFile(appDataRoot) ?? undefined;
    if (cookieFile) warnings.push("Using existing BiliSum Bilibili cookie file from the app data root.");
    else if (cookieBridge.warning) warnings.push(cookieBridge.warning);
  }
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
    VIDEO_SUM_YTDLP_COOKIES_FILE: cookieFile ?? ""
  };
  if (!resolvedDeepSeekApiKey) warnings.push("DeepSeek API key is not configured; authorize DEEPSEEK_API_KEY in Bitwarden or save it with secrets:set --platform=deepseek --type=token, then rerun setup.");
  if (!bilibiliCookie && !cookieFile) warnings.push("Bilibili cookies are not configured; some Bilibili videos may be unavailable to BiliSum.");
  if (!ffmpegDir) warnings.push("FFmpeg was not found; BiliSum visual evidence frame extraction will be unavailable.");

  const configRef = await writeLocalConfig({ projectRoot, baseUrl, accessToken, appDataRoot, configuredAt: new Date().toISOString() });
  await writeBiliSumEnv(projectRoot, env);

  const before = await health(baseUrl);
  if (before) {
    const settingsUpdated = await updateBiliSumSettings(baseUrl, accessToken, env);
    if (!settingsUpdated) warnings.push("BiliSum is running, but its settings API could not be updated automatically.");
    return {
      configured: true,
      projectRoot,
      baseUrl,
      appDataRoot,
      accessTokenConfigured: true,
      serviceStatus: "running",
      health: before,
      llmConfigured: Boolean(resolvedDeepSeekApiKey),
      settingsUpdated,
      warnings,
      configRef
    };
  }
  if (options.start === false) {
    return {
      configured: true,
      projectRoot,
      baseUrl,
      appDataRoot,
      accessTokenConfigured: true,
      serviceStatus: "unavailable",
      llmConfigured: Boolean(resolvedDeepSeekApiKey),
      settingsUpdated: false,
      warnings,
      configRef
    };
  }

  startBiliSum(projectRoot, env);
  const after = await waitForHealth(baseUrl, options.waitMs ?? 120_000);
  if (!after) warnings.push("BiliSum was started but did not become healthy before the setup timeout.");
  const settingsUpdated = after ? await updateBiliSumSettings(baseUrl, accessToken, env) : false;
  if (after && !settingsUpdated) warnings.push("BiliSum started, but its settings API could not be updated automatically.");
  return {
    configured: true,
    projectRoot,
    baseUrl,
    appDataRoot,
    accessTokenConfigured: true,
    serviceStatus: after ? "started" : "unavailable",
    health: after ?? undefined,
    llmConfigured: Boolean(resolvedDeepSeekApiKey),
    settingsUpdated,
    warnings,
    configRef
  };
}

export async function bilisumSetupStatus(): Promise<Record<string, unknown>> {
  const config = readBiliSumLocalConfig();
  const baseUrl = config.baseUrl ?? "http://127.0.0.1:3838";
  return {
    configured: Boolean(config.projectRoot && config.accessToken),
    projectRoot: config.projectRoot ?? bilisumProjectRoot,
    baseUrl,
    appDataRoot: config.appDataRoot ?? bilisumAppDataRoot,
    accessTokenConfigured: Boolean(config.accessToken),
    serviceHealth: await health(baseUrl),
    serviceSettings: config.accessToken ? await requestJson(baseUrl, "/api/v1/settings", config.accessToken) : null
  };
}
