import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { wechatRssFeeds } from "../config.js";

export type TaskId =
  | "collect:hotspots"
  | "collect:subscriptions";

export const taskIds: readonly TaskId[] = [
  "collect:hotspots",
  "collect:subscriptions"
];

export function isTaskId(value: string | undefined): value is TaskId {
  return Boolean(value && (taskIds as readonly string[]).includes(value));
}

export type TaskDefinition = {
  id: TaskId;
  description: string;
  intervalMinutes: number;
  enabled: boolean;
  reason?: string;
  params?: Record<string, string | number | boolean>;
};

export type SchedulerState = {
  tasks: Record<string, { lastStartedAt?: string; lastFinishedAt?: string; lastStatus?: "ok" | "error"; message?: string }>;
};

export type PlannedTask = TaskDefinition & {
  due: boolean;
  lastFinishedAt?: string;
  nextRunAt?: string;
};

const statePath = path.join("data", "scheduler", "state.json");

export function buildDefaultTasks(): TaskDefinition[] {
  return [
    {
      id: "collect:hotspots",
      description: "Collect non-social public hotspot sources. Browser social sources run through Codex automations.",
      intervalMinutes: 60,
      enabled: true
    },
    {
      id: "collect:subscriptions",
      description: "Collect non-browser subscription sources including WeChat RSS.",
      intervalMinutes: 60,
      enabled: true,
      params: { wechatFeeds: wechatRssFeeds.join(",") }
    }
  ];
}

export async function readSchedulerState(): Promise<SchedulerState> {
  try {
    return JSON.parse(await readFile(statePath, "utf8")) as SchedulerState;
  } catch {
    return { tasks: {} };
  }
}

export function planTasks(tasks: TaskDefinition[], state: SchedulerState, now = new Date()): PlannedTask[] {
  return tasks.map((task) => {
    const previous = state.tasks[task.id];
    const lastFinishedAt = previous?.lastFinishedAt;
    const nextRunAt = lastFinishedAt
      ? new Date(new Date(lastFinishedAt).getTime() + task.intervalMinutes * 60_000).toISOString()
      : undefined;
    const due = task.enabled && (!nextRunAt || new Date(nextRunAt).getTime() <= now.getTime());
    return { ...task, due, lastFinishedAt, nextRunAt };
  });
}

export async function writeTaskResult(
  taskId: TaskId,
  result: { startedAt: string; finishedAt: string; status: "ok" | "error"; message?: string }
): Promise<string> {
  const state = await readSchedulerState();
  state.tasks[taskId] = {
    lastStartedAt: result.startedAt,
    lastFinishedAt: result.finishedAt,
    lastStatus: result.status,
    message: result.message
  };
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
  return statePath.replaceAll("\\", "/");
}
