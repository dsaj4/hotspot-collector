import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { artifactPath } from "./paths.js";

export type BrowserSessionStatus = {
  platform: string;
  configured: boolean;
  profileDir: string;
  lastOpenedAt?: string;
  loginUrl?: string;
  cdpPort?: number;
};

function sessionDir(platform: string, rootDir = process.cwd()): string {
  return rootDir === process.cwd()
    ? artifactPath(path.join("data", "sessions", platform.toLowerCase()))
    : path.join(rootDir, "data", "sessions", platform.toLowerCase());
}

function metadataPath(platform: string, rootDir = process.cwd()): string {
  return path.join(sessionDir(platform, rootDir), "session.json");
}

function defaultLoginUrl(platform: string): string {
  if (platform === "x") return "https://x.com/login";
  if (platform === "weibo") return "https://weibo.com/login.php";
  if (platform === "zhihu") return "https://www.zhihu.com/signin";
  if (platform === "bilibili") return "https://passport.bilibili.com/login";
  return "about:blank";
}

function knownBrowserCandidates(): string[] {
  return [
    process.env.BROWSER_EXECUTABLE_PATH ?? "",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  ].filter(Boolean);
}

export function findBrowserExecutable(): string | null {
  return knownBrowserCandidates().find((candidate) => existsSync(candidate)) ?? null;
}

export async function browserSessionStatus(platform: string, rootDir = process.cwd()): Promise<BrowserSessionStatus> {
  const normalized = platform.trim().toLowerCase();
  const profileDir = path.join(sessionDir(normalized, rootDir), "profile");
  try {
    const metadata = JSON.parse(await readFile(metadataPath(normalized, rootDir), "utf8")) as BrowserSessionStatus;
    return { ...metadata, configured: existsSync(profileDir), profileDir };
  } catch {
    return { platform: normalized, configured: existsSync(profileDir), profileDir };
  }
}

export async function clearBrowserSession(platform: string, rootDir = process.cwd()): Promise<{ cleared: boolean }> {
  const normalized = platform.trim().toLowerCase();
  const dir = sessionDir(normalized, rootDir);
  if (!existsSync(dir)) return { cleared: false };
  await rm(dir, { recursive: true, force: true });
  return { cleared: true };
}

export async function openBrowserLogin(input: {
  platform: string;
  loginUrl?: string;
  browserPath?: string;
}, rootDir = process.cwd()): Promise<BrowserSessionStatus & { launched: boolean }> {
  const platform = input.platform.trim().toLowerCase();
  if (!platform) throw new Error("platform is required.");

  const browserPath = input.browserPath || findBrowserExecutable();
  if (!browserPath) {
    throw new Error("No browser executable found. Set BROWSER_EXECUTABLE_PATH to Chrome or Edge.");
  }

  const profileDir = path.join(sessionDir(platform, rootDir), "profile");
  const loginUrl = input.loginUrl || defaultLoginUrl(platform);
  await mkdir(profileDir, { recursive: true });

  const child = spawn(
    browserPath,
    [`--user-data-dir=${profileDir}`, "--no-first-run", "--new-window", loginUrl],
    { detached: true, stdio: "ignore", windowsHide: false }
  );
  child.unref();

  const status: BrowserSessionStatus = {
    platform,
    configured: true,
    profileDir,
    loginUrl,
    lastOpenedAt: new Date().toISOString()
  };
  await writeFile(metadataPath(platform, rootDir), JSON.stringify(status, null, 2), "utf8");
  return { ...status, launched: true };
}

export async function openBrowserCdp(input: {
  platform: string;
  port?: number;
  url?: string;
  browserPath?: string;
}, rootDir = process.cwd()): Promise<BrowserSessionStatus & { launched: boolean; alreadyRunning: boolean }> {
  const platform = input.platform.trim().toLowerCase();
  if (!platform) throw new Error("platform is required.");

  const port = input.port ?? 9223;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (response.ok) {
      const status = await browserSessionStatus(platform, rootDir);
      return { ...status, cdpPort: port, launched: false, alreadyRunning: true };
    }
  } catch {
    // Launch the dedicated profile below.
  }

  const browserPath = input.browserPath || findBrowserExecutable();
  if (!browserPath) {
    throw new Error("No browser executable found. Set BROWSER_EXECUTABLE_PATH to Chrome or Edge.");
  }

  const profileDir = path.join(sessionDir(platform, rootDir), "profile");
  const url = input.url || (platform === "bilibili" ? "https://www.bilibili.com/" : "about:blank");
  await mkdir(profileDir, { recursive: true });

  const child = spawn(
    browserPath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--new-window",
      url
    ],
    { detached: true, stdio: "ignore", windowsHide: true }
  );
  child.unref();

  const status: BrowserSessionStatus = {
    platform,
    configured: true,
    profileDir,
    loginUrl: url,
    cdpPort: port,
    lastOpenedAt: new Date().toISOString()
  };
  await writeFile(metadataPath(platform, rootDir), JSON.stringify(status, null, 2), "utf8");
  return { ...status, launched: true, alreadyRunning: false };
}
